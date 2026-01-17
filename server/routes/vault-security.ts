/**
 * Vault Security Admin Routes
 * 
 * Endpoints para auditoría y monitoreo de logs inmutables de Vault.
 * 
 * Endpoints:
 * - GET /api/admin/vault/integrity - Verificar integridad
 * - GET /api/admin/vault/audit - Reporte de auditoría
 * - GET /api/admin/vault/tampering - Intentos de tampering
 * - GET /api/admin/vault/compliance - Reporte de compliance
 */

import { Router } from "express";
import { vaultImmutabilityService } from "../lib/vault-immutability-service.js";

const router = Router();

/**
 * GET /api/admin/vault/integrity
 * Verifica que los logs de vault sean inmutables
 */
router.get("/integrity", async (req, res) => {
  try {
    const result = await vaultImmutabilityService.verifyVaultImmutability();

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[VaultSecurity] Error verifying integrity:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to verify vault integrity",
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/vault/audit
 * Genera reporte de auditoría de integridad de Vault
 */
router.get("/audit", async (req, res) => {
  try {
    const audit = await vaultImmutabilityService.auditVaultIntegrity();

    return res.json({
      success: true,
      data: audit,
    });
  } catch (error: any) {
    console.error("[VaultSecurity] Error generating audit:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate audit report",
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/vault/tampering
 * Lista intentos de tampering detectados
 * 
 * Query params:
 * - limit: máximo de registros (default 100)
 */
router.get("/tampering", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

    // Obtener intentos de tampering
    const tampering = await vaultImmutabilityService.getTamperingAttempts(
      undefined,
      limit
    );

    return res.json({
      success: true,
      data: tampering,
      totalCount: tampering.length,
    });
  } catch (error: any) {
    console.error("[VaultSecurity] Error fetching tampering attempts:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch tampering attempts",
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/vault/compliance
 * Genera reporte de compliance para auditoría
 */
router.get("/compliance", async (req, res) => {
  try {
    const report = await vaultImmutabilityService.generateComplianceReport();

    // Retornar como markdown o JSON
    const format = req.query.format || "json";

    if (format === "markdown") {
      return res.type("text/markdown").send(report);
    }

    return res.json({
      success: true,
      data: {
        report,
        generatedAt: new Date().toISOString(),
        format: "markdown",
      },
    });
  } catch (error: any) {
    console.error("[VaultSecurity] Error generating compliance report:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate compliance report",
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/vault/test-immutability
 * Test endpoint: Intenta eliminar un log para verificar que falla
 * SOLO para testing/verification en desarrollo
 */
router.post("/test-immutability", async (req, res) => {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      error: "Test endpoint not available in production",
    });
  }

  try {
    // Este endpoint intentará ejecutar DELETE que debería fallar
    const testResult = {
      endpoint: "/api/admin/vault/test-immutability",
      test: "Intenta eliminar un log de vault",
      expected: "DELETE debe ser rechazado por trigger",
      timestamp: new Date().toISOString(),
      instruction:
        "Si esta solicitud retorna 500 con 'cannot be deleted', entonces la inmutabilidad está funcionando correctamente.",
    };

    return res.json({
      success: true,
      message:
        "Para probar inmutabilidad, ejecutar en la consola SQL: DELETE FROM public.vault_access_log LIMIT 1;",
      data: testResult,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
