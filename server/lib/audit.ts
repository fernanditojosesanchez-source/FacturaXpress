import { db } from "../db.js";
import { auditLogs, loginAttempts } from "@shared/schema";
import { sendToSIEM } from "./siem.js";

/**
 * Sistema de auditoría centralizado
 * Registra todas las acciones sensibles del sistema
 */

interface AuditLogEntry {
  userId: string | null;
  action: string;
  ipAddress: string;
  userAgent?: string;
  details?: any;
  tenantId?: string;
}

interface LoginAttemptEntry {
  username: string;
  ipAddress: string;
  success: boolean;
  userAgent?: string;
}

/**
 * Registrar intento de login (éxito o fallo)
 */
export async function logLoginAttempt(entry: LoginAttemptEntry): Promise<void> {
  try {
    await db.insert(loginAttempts).values({
      username: entry.username,
      ipAddress: entry.ipAddress,
      success: entry.success,
      userAgent: entry.userAgent,
      attemptedAt: new Date(),
    });

    // Enviar a SIEM (eventos de login son relevantes)
    await sendToSIEM({
      type: entry.success ? "login_success" : "login_failed",
      level: entry.success ? "info" : "warn",
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      details: { username: entry.username },
    });
  } catch (error) {
    console.error("[Audit] Error logging login attempt:", error);
  }
}

/**
 * Registrar evento de auditoría general
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      details: entry.details || {},
      createdAt: new Date(),
    });

    // Log crítico a consola para alertas inmediatas
    if (isActionCritical(entry.action)) {
      console.warn(`[AUDIT CRITICAL] ${entry.action} by ${entry.userId || "anonymous"} from ${entry.ipAddress}`);
    }

    // Enviar a SIEM: sólo críticos por defecto o todo si está habilitado
    const sendAll = ["1", "true"].includes(String(process.env.SIEM_ENABLE_ALL || "").toLowerCase());
    if (sendAll || isActionCritical(entry.action)) {
      await sendToSIEM({
        type: entry.action,
        level: isActionCritical(entry.action) ? "warn" : "info",
        userId: entry.userId,
        tenantId: entry.tenantId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        details: entry.details,
      });
    }
  } catch (error) {
    console.error("[Audit] Error logging audit:", error);
  }
}

/**
 * Acciones que requieren alerta inmediata
 */
function isActionCritical(action: string): boolean {
  const criticalActions = [
    "login_failed_multiple",
    "account_locked",
    "password_changed",
    "user_deleted",
    "tenant_deleted",
    "credentials_modified",
    "api_key_created",
    "factura_deleted",
    "unauthorized_access_attempt",
  ];
  return criticalActions.includes(action);
}

/**
 * Acciones predefinidas para consistencia
 */
export const AuditActions = {
  // Autenticación
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  LOGIN_FAILED_MULTIPLE: "login_failed_multiple",
  LOGOUT: "logout",
  TOKEN_REFRESHED: "token_refreshed",
  ACCOUNT_LOCKED: "account_locked",
  
  // Usuarios
  USER_CREATE: "user_created",
  USER_UPDATE: "user_updated",
  USER_DELETE: "user_deleted",
  USER_LIST: "user_listed",
  USER_DEACTIVATE: "user_deactivated",
  USER_ROLE_CHANGED: "user_role_changed",
  PASSWORD_CHANGE: "password_changed",
  
  // Tenants
  TENANT_CREATED: "tenant_created",
  TENANT_UPDATED: "tenant_updated",
  TENANT_DELETED: "tenant_deleted",
  
  // Configuración
  EMISOR_UPDATED: "emisor_updated",
  CREDENTIALS_SAVED: "credentials_saved",
  CREDENTIALS_VIEWED: "credentials_viewed",
  
  // Facturas
  FACTURA_CREATED: "factura_created",
  FACTURA_TRANSMITTED: "factura_transmitted",
  FACTURA_DELETED: "factura_deleted",
  FACTURA_INVALIDATED: "factura_invalidated",
  
  // API Keys
  API_KEY_CREATED: "api_key_created",
  API_KEY_DELETED: "api_key_deleted",
  API_KEY_USED: "api_key_used",
  
  // Contingencia
  CONTINGENCIA_ADDED: "contingencia_added",
  CONTINGENCIA_PROCESSED: "contingencia_processed",
  
  // Anulaciones
  ANULACION_CREATED: "anulacion_created",
  ANULACION_PROCESSED: "anulacion_processed",
  
  // Seguridad
  UNAUTHORIZED_ACCESS: "unauthorized_access_attempt",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
} as const;

/**
 * Helper para obtener IP del request
 */
export function getClientIP(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Helper para obtener User Agent
 */
export function getUserAgent(req: any): string | undefined {
  return req.headers["user-agent"];
}
