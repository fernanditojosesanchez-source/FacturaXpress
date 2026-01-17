/**
 * Servicio de Aprobación Just-In-Time (JIT) para Sigma Support
 * 
 * Implementa workflow de 3 pasos:
 * 1. Sigma solicita acceso → Estado: PENDING → Notifica a tenant
 * 2. Admin del tenant aprueba/rechaza → Estado: APPROVED/REJECTED
 * 3. Si aprobado → Genera token temporal (2h) en sigmaSupportAccessTable
 * 
 * Características:
 * - Tokens de corta duración (30min - 2h, default 2h)
 * - Aprobación obligatoria del tenant
 * - Máximo 2 extensiones con re-aprobación
 * - Expiración automática de solicitudes (24h)
 * - Notificaciones por email
 * - Políticas configurables por tenant
 * 
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #3 (P1: Sigma Support sin JIT)
 * @see shared/schema-sigma-jit.ts
 */

import { db } from "../db.js";
import { 
  sigmaSupportAccessRequestsTable, 
  sigmaSupportAccessExtensionsTable,
  sigmaSupportJitPoliciesTable,
  type SigmaSupportAccessRequest,
  type SigmaSupportJitPolicy,
} from "../../shared/schema-sigma-jit.js";
import { sigmaSupportAccessTable } from "../../shared/schema-sigma-support.js";
import { eq, and, or, lt, desc } from "drizzle-orm";

interface RequestAccessParams {
  requestedBy: string;
  requestedByName: string;
  requestedByEmail: string;
  tenantId: string;
  tenantNombre: string;
  reason: string;
  estimatedDuration?: number; // ms (default 2h)
  urgency?: "low" | "normal" | "high" | "critical";
  scopeRequested?: {
    canViewLogs: boolean;
    canViewMetrics: boolean;
    canViewAudit: boolean;
    canExportData: boolean;
  };
}

interface ReviewRequestParams {
  requestId: string;
  reviewedBy: string;
  reviewedByName: string;
  approved: boolean;
  reviewNotes?: string;
  customDuration?: number; // ms (override default)
}

interface ExtendAccessParams {
  accessId: string;
  requestedBy: string;
  requestedByName: string;
  reason: string;
  extensionDuration: number; // ms
}

/**
 * 1. Solicitar acceso JIT (Paso 1 del workflow)
 */
export async function requestJitAccess(params: RequestAccessParams): Promise<SigmaSupportAccessRequest> {
  const {
    requestedBy,
    requestedByName,
    requestedByEmail,
    tenantId,
    tenantNombre,
    reason,
    estimatedDuration = 7200000, // 2 horas
    urgency = "normal",
    scopeRequested = {
      canViewLogs: true,
      canViewMetrics: true,
      canViewAudit: false,
      canExportData: false,
    },
  } = params;

  // Obtener política del tenant
  const policy = await getOrCreateJitPolicy(tenantId);

  // Validar duración contra política
  const maxDuration = policy.maxAccessDuration || 7200000;
  const finalDuration = Math.min(estimatedDuration, maxDuration);

  // Validar scope contra política permitida
  const allowedScopes = policy.allowedScopes as any || {};
  const finalScope = {
    canViewLogs: scopeRequested.canViewLogs && allowedScopes.canViewLogs !== false,
    canViewMetrics: scopeRequested.canViewMetrics && allowedScopes.canViewMetrics !== false,
    canViewAudit: scopeRequested.canViewAudit && allowedScopes.canViewAudit === true,
    canExportData: scopeRequested.canExportData && allowedScopes.canExportData === true,
  };

  // Crear solicitud
  const expiresAt = new Date(Date.now() + (policy.requestExpirationTime || 86400000)); // 24h

  const [request] = await db
    .insert(sigmaSupportAccessRequestsTable)
    .values({
      requestedBy,
      requestedByName,
      requestedByEmail,
      tenantId,
      tenantNombre,
      reason,
      estimatedDuration: finalDuration,
      urgency,
      scopeRequested: finalScope,
      status: "pending",
      expiresAt,
    })
    .returning();

  // Auto-aprobar si la política lo permite y es urgencia crítica
  if (
    policy.autoApproveForUrgency === "critical" &&
    urgency === "critical"
  ) {
    console.log(`[JIT] Auto-aprobando solicitud crítica: ${request.id}`);
    return await reviewJitAccessRequest({
      requestId: request.id,
      reviewedBy: "system",
      reviewedByName: "Auto-Approval System",
      approved: true,
      reviewNotes: "Auto-aprobado por urgencia crítica según política del tenant",
    });
  }

  // Enviar notificación a admins del tenant
  if (policy.notifyAdminsOnRequest) {
    await sendJitRequestNotification(request, policy);
  }

  console.log(`[JIT] Solicitud creada: ${request.id} (tenant: ${tenantNombre}, urgency: ${urgency})`);
  return request;
}

/**
 * 2. Revisar solicitud (Paso 2 del workflow)
 */
export async function reviewJitAccessRequest(params: ReviewRequestParams): Promise<SigmaSupportAccessRequest> {
  const {
    requestId,
    reviewedBy,
    reviewedByName,
    approved,
    reviewNotes,
    customDuration,
  } = params;

  // Obtener solicitud
  const [request] = await db
    .select()
    .from(sigmaSupportAccessRequestsTable)
    .where(eq(sigmaSupportAccessRequestsTable.id, requestId))
    .limit(1);

  if (!request) {
    throw new Error(`Solicitud ${requestId} no encontrada`);
  }

  if (request.status !== "pending") {
    throw new Error(`Solicitud ${requestId} ya fue revisada (estado: ${request.status})`);
  }

  if (new Date() > new Date(request.expiresAt)) {
    // Marcar como expirada
    await db
      .update(sigmaSupportAccessRequestsTable)
      .set({ status: "expired" })
      .where(eq(sigmaSupportAccessRequestsTable.id, requestId));
    
    throw new Error(`Solicitud ${requestId} expiró`);
  }

  const newStatus = approved ? "approved" : "rejected";
  const reviewedAt = new Date();

  // Actualizar solicitud
  const [updatedRequest] = await db
    .update(sigmaSupportAccessRequestsTable)
    .set({
      status: newStatus,
      reviewedBy,
      reviewedByName,
      reviewedAt,
      reviewNotes,
    })
    .where(eq(sigmaSupportAccessRequestsTable.id, requestId))
    .returning();

  // Si fue aprobada, generar acceso temporal
  if (approved) {
    const duration = customDuration || request.estimatedDuration;
    const accessExpiresAt = new Date(Date.now() + duration);

    const [access] = await db
      .insert(sigmaSupportAccessTable)
      .values({
        supportUserId: request.requestedBy,
        supportUserName: request.requestedByName,
        supportEmail: request.requestedByEmail,
        tenantId: request.tenantId,
        tenantNombre: request.tenantNombre,
        tipoAcceso: "readonly",
        canViewLogs: (request.scopeRequested as any).canViewLogs,
        canViewMetrics: (request.scopeRequested as any).canViewMetrics,
        canViewAudit: (request.scopeRequested as any).canViewAudit,
        canExportData: (request.scopeRequested as any).canExportData,
        fechaInicio: reviewedAt,
        fechaFin: accessExpiresAt,
        activo: true,
        razon: request.reason,
        otorgadoPor: reviewedBy,
      })
      .returning();

    // Vincular acceso a solicitud
    await db
      .update(sigmaSupportAccessRequestsTable)
      .set({
        accessGrantedId: access.id,
        accessExpiresAt,
      })
      .where(eq(sigmaSupportAccessRequestsTable.id, requestId));

    console.log(`[JIT] Acceso otorgado: ${access.id} (expira: ${accessExpiresAt.toISOString()})`);

    // Notificar al solicitante
    await sendJitApprovedNotification(updatedRequest, access);
  } else {
    console.log(`[JIT] Solicitud rechazada: ${requestId} (razón: ${reviewNotes || "N/A"})`);
    
    // Notificar al solicitante
    await sendJitRejectedNotification(updatedRequest);
  }

  return updatedRequest;
}

/**
 * 3. Extender acceso (requiere nueva aprobación)
 */
export async function extendJitAccess(params: ExtendAccessParams): Promise<SigmaSupportAccessRequest> {
  const { accessId, requestedBy, requestedByName, reason, extensionDuration } = params;

  // Obtener acceso actual
  const [access] = await db
    .select()
    .from(sigmaSupportAccessTable)
    .where(eq(sigmaSupportAccessTable.id, accessId))
    .limit(1);

  if (!access) {
    throw new Error(`Acceso ${accessId} no encontrado`);
  }

  if (!access.activo || !access.fechaFin || new Date() > new Date(access.fechaFin)) {
    throw new Error(`Acceso ${accessId} ya expiró o está inactivo`);
  }

  // Verificar límite de extensiones
  const policy = await getOrCreateJitPolicy(access.tenantId);
  const existingExtensions = await db
    .select()
    .from(sigmaSupportAccessExtensionsTable)
    .where(eq(sigmaSupportAccessExtensionsTable.originalAccessId, accessId));

  if (existingExtensions.length >= (policy.maxExtensions || 2)) {
    throw new Error(`Acceso ${accessId} alcanzó el límite de extensiones (${policy.maxExtensions})`);
  }

  // Crear nueva solicitud de extensión
  const request = await requestJitAccess({
    requestedBy,
    requestedByName,
    requestedByEmail: access.supportEmail,
    tenantId: access.tenantId,
    tenantNombre: access.tenantNombre,
    reason: `[EXTENSIÓN] ${reason}`,
    estimatedDuration: extensionDuration,
    urgency: "normal",
    scopeRequested: {
      canViewLogs: access.canViewLogs || false,
      canViewMetrics: access.canViewMetrics || false,
      canViewAudit: access.canViewAudit || false,
      canExportData: access.canExportData || false,
    },
  });

  console.log(`[JIT] Solicitud de extensión creada: ${request.id} (access: ${accessId})`);
  return request;
}

/**
 * 4. Revocar acceso inmediatamente
 */
export async function revokeJitAccess(accessId: string, revokedBy: string, reason?: string): Promise<void> {
  const [access] = await db
    .update(sigmaSupportAccessTable)
    .set({
      activo: false,
      revokedAt: new Date(),
      revisadoPor: revokedBy,
    })
    .where(eq(sigmaSupportAccessTable.id, accessId))
    .returning();

  if (!access) {
    throw new Error(`Acceso ${accessId} no encontrado`);
  }

  // Actualizar solicitud relacionada
  await db
    .update(sigmaSupportAccessRequestsTable)
    .set({ status: "revoked" })
    .where(eq(sigmaSupportAccessRequestsTable.accessGrantedId, accessId));

  console.log(`[JIT] Acceso revocado: ${accessId} (razón: ${reason || "N/A"})`);
}

/**
 * 5. Obtener o crear política JIT del tenant
 */
async function getOrCreateJitPolicy(tenantId: string): Promise<SigmaSupportJitPolicy> {
  let [policy] = await db
    .select()
    .from(sigmaSupportJitPoliciesTable)
    .where(eq(sigmaSupportJitPoliciesTable.tenantId, tenantId))
    .limit(1);

  if (!policy) {
    // Crear política con defaults
    [policy] = await db
      .insert(sigmaSupportJitPoliciesTable)
      .values({
        tenantId,
        requireApproval: true,
        maxAccessDuration: 7200000, // 2h
        maxExtensions: 2,
        requestExpirationTime: 86400000, // 24h
        notifyAdminsOnRequest: true,
        allowedScopes: {
          canViewLogs: true,
          canViewMetrics: true,
          canViewAudit: false,
          canExportData: false,
        },
      })
      .returning();
  }

  return policy;
}

/**
 * 6. Expirar solicitudes antiguas (cron job)
 */
export async function expirePendingRequests(): Promise<number> {
  const now = new Date();

  const expired = await db
    .update(sigmaSupportAccessRequestsTable)
    .set({ status: "expired" })
    .where(
      and(
        eq(sigmaSupportAccessRequestsTable.status, "pending"),
        lt(sigmaSupportAccessRequestsTable.expiresAt, now)
      )
    )
    .returning();

  console.log(`[JIT] Expiradas ${expired.length} solicitudes pendientes`);
  return expired.length;
}

/**
 * 7. Expirar accesos vencidos (cron job)
 */
export async function expireActiveAccesses(): Promise<number> {
  const now = new Date();

  const expired = await db
    .update(sigmaSupportAccessTable)
    .set({ activo: false })
    .where(
      and(
        eq(sigmaSupportAccessTable.activo, true),
        lt(sigmaSupportAccessTable.fechaFin, now)
      )
    )
    .returning();

  console.log(`[JIT] Expirados ${expired.length} accesos activos`);
  return expired.length;
}

/**
 * Helpers de notificaciones (placeholder - integrar con email service)
 */

async function sendJitRequestNotification(
  request: SigmaSupportAccessRequest,
  policy: SigmaSupportJitPolicy
): Promise<void> {
  // TODO: Integrar con servicio de email (SendGrid, AWS SES, etc.)
  console.log(`[JIT] Notificación enviada a admins de ${request.tenantNombre}`);
  console.log(`  - Solicitud: ${request.id}`);
  console.log(`  - Solicitante: ${request.requestedByName} (${request.requestedByEmail})`);
  console.log(`  - Urgencia: ${request.urgency}`);
  console.log(`  - Razón: ${request.reason}`);
  console.log(`  - Emails: ${policy.notifyAdminEmails || "N/A"}`);

  await db
    .update(sigmaSupportAccessRequestsTable)
    .set({
      notificationSent: true,
      notificationSentAt: new Date(),
    })
    .where(eq(sigmaSupportAccessRequestsTable.id, request.id));
}

async function sendJitApprovedNotification(
  request: SigmaSupportAccessRequest,
  access: any
): Promise<void> {
  console.log(`[JIT] Notificación de aprobación enviada a ${request.requestedByEmail}`);
  console.log(`  - Acceso válido hasta: ${access.fechaFin.toISOString()}`);
  console.log(`  - Token: ${access.id}`);
}

async function sendJitRejectedNotification(request: SigmaSupportAccessRequest): Promise<void> {
  console.log(`[JIT] Notificación de rechazo enviada a ${request.requestedByEmail}`);
  console.log(`  - Razón: ${request.reviewNotes || "No especificada"}`);
}

/**
 * Queries helpers
 */

export async function getPendingRequests(tenantId?: string) {
  let query = db
    .select()
    .from(sigmaSupportAccessRequestsTable)
    .where(eq(sigmaSupportAccessRequestsTable.status, "pending"))
    .orderBy(desc(sigmaSupportAccessRequestsTable.createdAt));

  if (tenantId) {
    query = db
      .select()
      .from(sigmaSupportAccessRequestsTable)
      .where(and(
        eq(sigmaSupportAccessRequestsTable.status, "pending"),
        eq(sigmaSupportAccessRequestsTable.tenantId, tenantId)
      ))
      .orderBy(desc(sigmaSupportAccessRequestsTable.createdAt));
  }

  return query;
}

export async function getActiveAccesses(supportUserId?: string) {
  let query = db
    .select()
    .from(sigmaSupportAccessTable)
    .where(eq(sigmaSupportAccessTable.activo, true))
    .orderBy(desc(sigmaSupportAccessTable.fechaInicio));

  if (supportUserId) {
    query = db
      .select()
      .from(sigmaSupportAccessTable)
      .where(and(
        eq(sigmaSupportAccessTable.activo, true),
        eq(sigmaSupportAccessTable.supportUserId, supportUserId)
      ))
      .orderBy(desc(sigmaSupportAccessTable.fechaInicio));
  }

  return query;
}
