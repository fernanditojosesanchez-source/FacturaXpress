/**
 * Rutas API para Sistema JIT (Just-In-Time) - Sigma Support
 * 
 * Endpoints:
 * 1. POST /api/sigma/access/request - Sigma solicita acceso
 * 2. GET  /api/admin/sigma/requests/pending - Admin lista solicitudes pendientes
 * 3. POST /api/admin/sigma/requests/:id/review - Admin aprueba/rechaza
 * 4. POST /api/sigma/access/:id/extend - Sigma solicita extensión
 * 5. POST /api/admin/sigma/access/:id/revoke - Admin revoca acceso
 * 6. GET  /api/sigma/access/active - Listar accesos activos
 * 7. GET  /api/admin/sigma/jit/policy - Obtener política JIT
 * 8. PUT  /api/admin/sigma/jit/policy - Actualizar política JIT
 * 
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #3
 */

import { Router, Request, Response } from "express";
import { requireAuth, requireTenantAdmin } from "../auth.js";
import {
  requestJitAccess,
  reviewJitAccessRequest,
  extendJitAccess,
  revokeJitAccess,
  getPendingRequests,
  getActiveAccesses,
  expirePendingRequests,
  expireActiveAccesses,
} from "../lib/sigma-jit-service.js";
import { db } from "../db.js";
import { sigmaSupportJitPoliciesTable } from "../../shared/schema-sigma-jit.js";
import { eq } from "drizzle-orm";
import {
  insertSigmaSupportAccessRequestSchema,
  reviewAccessRequestSchema,
  extendAccessRequestSchema,
  updateJitPolicySchema,
} from "../../shared/schema-sigma-jit.js";

const router = Router();

/**
 * 1. Solicitar acceso JIT (Sigma Support)
 * POST /api/sigma/access/request
 */
router.post("/access/request", requireAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = insertSigmaSupportAccessRequestSchema.parse(req.body);

    const request = await requestJitAccess({
      ...validatedData,
      requestedBy: (req as any).user!.id,
      requestedByName: (req as any).user!.email, // O nombre del usuario si está disponible
      requestedByEmail: (req as any).user!.email,
    });

    res.json({
      success: true,
      data: request,
      message: "Solicitud de acceso creada. Pendiente de aprobación del tenant.",
    });
  } catch (error: any) {
    console.error("[JIT API] Error solicitando acceso:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al crear solicitud",
    });
  }
});

/**
 * 2. Listar solicitudes pendientes (Tenant Admin)
 * GET /api/admin/sigma/requests/pending
 */
router.get("/admin/requests/pending", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user!.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: "TenantId requerido",
      });
    }

    const requests = await getPendingRequests(tenantId);

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error: any) {
    console.error("[JIT API] Error listando solicitudes:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al listar solicitudes",
    });
  }
});

/**
 * 3. Revisar solicitud (Aprobar/Rechazar) (Tenant Admin)
 * POST /api/admin/sigma/requests/:id/review
 */
router.post("/admin/requests/:id/review", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = reviewAccessRequestSchema.parse({
      requestId: id,
      ...req.body,
    });

    const updatedRequest = await reviewJitAccessRequest({
      requestId: validatedData.requestId,
      reviewedBy: (req as any).user!.id,
      reviewedByName: (req as any).user!.email,
      approved: validatedData.approved,
      reviewNotes: validatedData.reviewNotes,
      customDuration: validatedData.customDuration,
    });

    res.json({
      success: true,
      data: updatedRequest,
      message: validatedData.approved
        ? "Solicitud aprobada. Acceso temporal otorgado."
        : "Solicitud rechazada.",
    });
  } catch (error: any) {
    console.error("[JIT API] Error revisando solicitud:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al revisar solicitud",
    });
  }
});

/**
 * 4. Solicitar extensión de acceso (Sigma Support)
 * POST /api/sigma/access/:id/extend
 */
router.post("/access/:id/extend", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = extendAccessRequestSchema.parse({
      accessId: id,
      ...req.body,
    });

    const extensionRequest = await extendJitAccess({
      accessId: validatedData.accessId,
      requestedBy: (req as any).user!.id,
      requestedByName: (req as any).user!.email,
      reason: validatedData.reason,
      extensionDuration: validatedData.extensionDuration,
    });

    res.json({
      success: true,
      data: extensionRequest,
      message: "Solicitud de extensión creada. Pendiente de aprobación.",
    });
  } catch (error: any) {
    console.error("[JIT API] Error extendiendo acceso:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al solicitar extensión",
    });
  }
});

/**
 * 5. Revocar acceso inmediatamente (Tenant Admin)
 * POST /api/admin/sigma/access/:id/revoke
 */
router.post("/admin/access/:id/revoke", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await revokeJitAccess(id, (req as any).user!.id, reason);

    res.json({
      success: true,
      message: "Acceso revocado exitosamente",
    });
  } catch (error: any) {
    console.error("[JIT API] Error revocando acceso:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al revocar acceso",
    });
  }
});

/**
 * 6. Listar accesos activos
 * GET /api/sigma/access/active
 */
router.get("/access/active", requireAuth, async (req: Request, res: Response) => {
  try {
    const { forUser } = req.query;

    const accesses = await getActiveAccesses(
      forUser === "me" ? (req as any).user!.id : undefined
    );

    res.json({
      success: true,
      data: accesses,
      count: accesses.length,
    });
  } catch (error: any) {
    console.error("[JIT API] Error listando accesos activos:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al listar accesos",
    });
  }
});

/**
 * 7. Obtener política JIT del tenant (Tenant Admin)
 * GET /api/admin/sigma/jit/policy
 */
router.get("/admin/jit/policy", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user!.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: "TenantId requerido",
      });
    }

    const [policy] = await db
      .select()
      .from(sigmaSupportJitPoliciesTable)
      .where(eq(sigmaSupportJitPoliciesTable.tenantId, tenantId))
      .limit(1);

    if (!policy) {
      return res.json({
        success: true,
        data: null,
        message: "No hay política configurada. Se usarán valores por defecto.",
      });
    }

    res.json({
      success: true,
      data: policy,
    });
  } catch (error: any) {
    console.error("[JIT API] Error obteniendo política:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al obtener política",
    });
  }
});

/**
 * 8. Actualizar política JIT del tenant (Tenant Admin)
 * PUT /api/admin/sigma/jit/policy
 */
router.put("/admin/jit/policy", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user!.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: "TenantId requerido",
      });
    }

    const validatedData = updateJitPolicySchema.parse({
      tenantId,
      ...req.body,
    });

    // Verificar si ya existe política
    const [existing] = await db
      .select()
      .from(sigmaSupportJitPoliciesTable)
      .where(eq(sigmaSupportJitPoliciesTable.tenantId, tenantId))
      .limit(1);

    let policy;

    if (existing) {
      // Actualizar
      [policy] = await db
        .update(sigmaSupportJitPoliciesTable)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(sigmaSupportJitPoliciesTable.tenantId, tenantId))
        .returning();
    } else {
      // Crear
      [policy] = await db
        .insert(sigmaSupportJitPoliciesTable)
        .values({
          requireApproval: true,
          maxAccessDuration: 7200000, // 2h
          maxExtensions: 2,
          requestExpirationTime: 86400000, // 24h
          notifyAdminsOnRequest: true,
          ...validatedData,
        })
        .returning();
    }

    res.json({
      success: true,
      data: policy,
      message: "Política JIT actualizada exitosamente",
    });
  } catch (error: any) {
    console.error("[JIT API] Error actualizando política:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al actualizar política",
    });
  }
});

/**
 * 9. Cron jobs (internal endpoints)
 * POST /api/admin/sigma/jit/expire-requests
 * POST /api/admin/sigma/jit/expire-accesses
 */
router.post("/admin/jit/expire-requests", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const count = await expirePendingRequests();

    res.json({
      success: true,
      message: `${count} solicitudes expiradas`,
      count,
    });
  } catch (error: any) {
    console.error("[JIT API] Error expirando solicitudes:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/admin/jit/expire-accesses", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const count = await expireActiveAccesses();

    res.json({
      success: true,
      message: `${count} accesos expirados`,
      count,
    });
  } catch (error: any) {
    console.error("[JIT API] Error expirando accesos:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
