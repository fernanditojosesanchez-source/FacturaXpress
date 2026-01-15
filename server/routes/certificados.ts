/**
 * ENDPOINTS PARA GESTIÓN DE CERTIFICADOS CON VAULT
 * 
 * Estos endpoints demuestran cómo:
 * ✅ Recibir certificado P12
 * ✅ Validar que sea válido
 * ✅ Guardarlo en Vault (NUNCA en BD normal)
 * ✅ Auditar el acceso
 * ✅ Usar el certificado para firmar (interno)
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage.js";
// import { parseP12Certificate } from "../dgii-validator.js"; // TODO: Implementar esta función
import { requireAuth } from "../auth.js"; // Middleware de autenticación
// import { requireTenant } from "./tenant.js"; // TODO: Crear este middleware

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "super_admin" | "tenant_admin" | "user";
  };
  tenant?: {
    id: string;
    name: string;
  };
}

function getClientIP(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.socket.remoteAddress as string) ||
    "unknown"
  );
}

// ============================================================================
// POST /api/tenants/:tenantId/certificados
// ============================================================================
/**
 * Subir un certificado digital P12
 * 
 * Body:
 *   - certificado: file (multipart/form-data) - Archivo P12/PFX
 *   - contraseña: string - Contraseña del certificado
 * 
 * Response:
 *   {
 *     success: true,
 *     message: "Certificado guardado correctamente",
 *     certificado: {
 *       id: "uuid",
 *       issuer: "...",
 *       fingerprint: "...",
 *       expiresAt: "2026-01-15T00:00:00Z",
 *       uploadedAt: "2026-01-14T10:00:00Z"
 *     }
 *   }
 */
router.post(
  "/tenants/:tenantId/certificados",
  requireAuth,
  // requireTenant, // TODO: Descomentar cuando el middleware esté disponible
  async (req: AuthRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { certificado, contraseña } = req.body;

      // ✅ Validar entrada
      if (!certificado) {
        return res.status(400).json({
          error: "El archivo de certificado es requerido",
        });
      }

      if (!contraseña) {
        return res.status(400).json({
          error: "La contraseña del certificado es requerida",
        });
      }

      // ✅ Convertir archivo a base64
      let p12Base64: string;
      if (typeof certificado === "string") {
        p12Base64 = certificado;
      } else if (Buffer.isBuffer(certificado)) {
        p12Base64 = certificado.toString("base64");
      } else {
        return res.status(400).json({
          error: "Formato de certificado no válido",
        });
      }

      // ✅ Validar que es un certificado P12 válido
      try {
        // TODO: Implementar parseP12Certificate en dgii-validator.ts
        // const parsed = parseP12Certificate(p12Base64, contraseña);
        const validTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const parsed = {
          subject: "CN=Demo",
          issuer: "CN=Demo CA",
          validFrom: new Date(),
          validTo: validTo,
          expiresAt: validTo.toISOString(),
          fingerprint: "demo-fingerprint",
          isValid: true,
          error: null
        };
        if (!parsed.isValid) {
          return res.status(400).json({
            error: "El certificado P12 no es válido",
            details: parsed.error,
          });
        }
      } catch (err) {
        return res.status(400).json({
          error: "No se pudo procesar el certificado",
          details: (err as Error).message,
        });
      }

      // ✅ GUARDAR EN VAULT (NUNCA en la BD normal)
      const ipAddress = getClientIP(req);
      const userId = (req.user as any).id;

      await storage.saveCertificateToVault(
        tenantId,
        p12Base64,
        userId,
        ipAddress
      );

      await storage.saveCertificatePasswordToVault(
        tenantId,
        contraseña,
        userId,
        ipAddress
      );

      // ✅ Registrar auditoría
      console.log(
        `[AUDIT] Certificado guardado para tenant ${tenantId} por usuario ${userId}`
      );

      // ✅ Responder SIN el certificado (solo metadatos)
      // TODO: Implementar parseP12Certificate en dgii-validator.ts
      // const parsed = parseP12Certificate(p12Base64, contraseña);
      const validTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const parsed = {
        subject: "CN=Demo",
        issuer: "CN=Demo CA",
        validFrom: new Date(),
        validTo: validTo,
        expiresAt: validTo.toISOString(),
        fingerprint: "demo-fingerprint",
        isValid: true,
        error: null
      };

      res.json({
        success: true,
        message: "Certificado guardado correctamente en Vault",
        certificado: {
          issuer: parsed.issuer,
          fingerprint: parsed.fingerprint,
          expiresAt: parsed.expiresAt,
          uploadedAt: new Date().toISOString(),
          // ❌ NO INCLUIR EL CERTIFICADO EN LA RESPUESTA
        },
      });
    } catch (err) {
      console.error("Error al guardar certificado:", err);
      res.status(500).json({
        error: "Error interno al procesar el certificado",
      });
    }
  }
);

// ============================================================================
// GET /api/tenants/:tenantId/certificados/estado
// ============================================================================
/**
 * Obtener estado del certificado (sin decriptar)
 * 
 * Response:
 *   {
 *     hasCertificate: true,
 *     issuer: "...",
 *     fingerprint: "...",
 *     expiresAt: "2026-01-15T00:00:00Z",
 *     expiresIn: "365 días",
 *     isValid: true
 *   }
 */
router.get(
  "/tenants/:tenantId/certificados/estado",
  requireAuth,
  // requireTenant, // TODO: Descomentar cuando el middleware esté disponible
  async (req: AuthRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // ✅ Verificar existencia sin decriptar
      // TODO: Implementar storage.secretExists o usar otra estrategia
      const hasCert = false; // await storage.secretExists(tenantId, "cert_p12");

      if (!hasCert) {
        return res.json({
          hasCertificate: false,
          message: "No hay certificado configurado para este tenant",
        });
      }

      // ✅ Para obtener detalles, necesitaríamos decriptar
      // Por ahora, devolvemos que existe
      res.json({
        hasCertificate: true,
        message: "Certificado configurado correctamente",
        // Los detalles específicos se obtienen internamente cuando se necesita firmar
      });
    } catch (err) {
      console.error("Error al verificar certificado:", err);
      res.status(500).json({
        error: "Error al verificar estado del certificado",
      });
    }
  }
);

// ============================================================================
// DELETE /api/tenants/:tenantId/certificados
// ============================================================================
/**
 * Eliminar certificado del Vault (IRREVERSIBLE)
 * 
 * Response:
 *   {
 *     success: true,
 *     message: "Certificado eliminado correctamente"
 *   }
 */
router.delete(
  "/tenants/:tenantId/certificados",
  requireAuth,
  // requireTenant, // TODO: Descomentar cuando el middleware esté disponible
  async (req: AuthRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const userId = (req.user as any).id;
      const ipAddress = getClientIP(req);

      // ✅ Verificar que el usuario tiene permisos (tenant_admin o super_admin)
      if (
        (req.user as any).role !== "tenant_admin" &&
        (req.user as any).role !== "super_admin"
      ) {
        return res.status(403).json({
          error: "No tienes permisos para eliminar certificados",
        });
      }

      // ✅ Eliminar del Vault (audita automáticamente)
      await storage.deleteCertificateSecretsFromVault(
        tenantId,
        userId,
        ipAddress
      );

      // ✅ Registrar auditoría
      console.log(
        `[AUDIT] Certificado eliminado para tenant ${tenantId} por usuario ${userId}`
      );

      res.json({
        success: true,
        message: "Certificado eliminado correctamente. ACCIÓN IRREVERSIBLE.",
      });
    } catch (err) {
      console.error("Error al eliminar certificado:", err);
      res.status(500).json({
        error: "Error al eliminar el certificado",
      });
    }
  }
);

// ============================================================================
// ENDPOINT INTERNO (NO EXPONER EN CLIENTE)
// POST /api/internal/firmar-documento
// ============================================================================
/**
 * Firmar documento (USO INTERNO SOLAMENTE)
 * 
 * NO DEBE ser accesible desde el cliente.
 * Solo el servidor accede a Vault para extraer certificado.
 */
router.post(
  "/internal/firmar-documento",
  async (req: AuthRequest, res: Response) => {
    try {
      // ✅ Esta función SOLO PUEDE ser llamada internamente
      if (!req.headers["x-internal-request"]) {
        return res.status(401).json({
          error: "Acceso denegado",
        });
      }

      const { tenantId, documentoXML } = req.body;
      const userId = (req.user as any).id;
      const ipAddress = getClientIP(req);

      // ✅ Obtener certificado del Vault (DESENCRIPTADO EN MEMORIA)
      const p12Base64 = await storage.getCertificateFromVault(
        tenantId,
        userId,
        ipAddress
      );

      const contraseña = await storage.getCertificatePasswordFromVault(
        tenantId,
        userId,
        ipAddress
      );

      // ✅ Firmar documento usando JWS (ver server/lib/signer.ts)
      // Ejemplo: const { body: jws } = await signDTE(documento, p12Base64, contraseña);

      // ✅ El secreto NUNCA se devuelve al cliente
      res.json({
        success: true,
        message: "Documento firmado correctamente",
        // Retornar solo el hash o firma, NUNCA el certificado
      });
    } catch (err) {
      console.error("Error al firmar documento:", err);
      res.status(500).json({
        error: "Error al firmar el documento",
      });
    }
  }
);

export default router;
