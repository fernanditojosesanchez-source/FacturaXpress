/**
 * Schema para Sistema de Aprobación Just-In-Time (JIT) - Sigma Support
 * 
 * Implementa workflow de 3 pasos:
 * 1. Sigma solicita acceso (PENDING)
 * 2. Tenant aprueba/rechaza (APPROVED/REJECTED)
 * 3. Token temporal de 2 horas se genera
 * 
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #3 (P1)
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, uuid, boolean, integer, index, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * Tabla de solicitudes de acceso JIT
 */
export const sigmaSupportAccessRequestsTable = pgTable(
  "sigma_support_access_requests",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

    // Solicitante (Sigma Support)
    requestedBy: uuid("requested_by").notNull(), // Usuario de Sigma que solicita
    requestedByName: varchar("requested_by_name", { length: 255 }).notNull(),
    requestedByEmail: varchar("requested_by_email", { length: 255 }).notNull(),

    // Tenant objetivo
    tenantId: uuid("tenant_id").notNull(),
    tenantNombre: varchar("tenant_nombre", { length: 255 }).notNull(),

    // Justificación
    reason: text("reason").notNull(), // "Debugging emisión lenta", "Investigar error 500"
    estimatedDuration: integer("estimated_duration").notNull().default(7200000), // ms (default 2h)
    urgency: varchar("urgency", { length: 20 }).notNull().default("normal"), // low, normal, high, critical

    // Scope solicitado
    scopeRequested: jsonb("scope_requested").notNull().default({
      canViewLogs: true,
      canViewMetrics: true,
      canViewAudit: false,
      canExportData: false,
    }),

    // Estado del workflow
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // pending, approved, rejected, expired, revoked

    // Aprobación
    reviewedBy: uuid("reviewed_by"), // Admin del tenant que aprobó/rechazó
    reviewedByName: varchar("reviewed_by_name", { length: 255 }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"), // Notas del revisor

    // Token generado (si fue aprobado)
    accessGrantedId: uuid("access_granted_id"), // FK a sigmaSupportAccessTable
    accessExpiresAt: timestamp("access_expires_at"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(), // Solicitud expira en 24h si no se responde

    // Break-Glass (Emergencia)
    isBreakGlass: boolean("is_break_glass").default(false),

    // Notificaciones
    notificationSent: boolean("notification_sent").default(false),
    notificationSentAt: timestamp("notification_sent_at"),
  },
  (table) => [
    index("idx_support_requests_tenant").on(table.tenantId, table.status),
    index("idx_support_requests_requester").on(table.requestedBy),
    index("idx_support_requests_status").on(table.status, table.createdAt),
    index("idx_support_requests_expires").on(table.expiresAt),
  ]
);

/**
 * Historial de extensiones de acceso
 */
export const sigmaSupportAccessExtensionsTable = pgTable(
  "sigma_support_access_extensions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

    // Acceso original que se extiende
    originalAccessId: uuid("original_access_id").notNull(),

    // Nueva solicitud de extensión
    requestId: uuid("request_id").notNull(), // FK a access_requests

    // Extensión otorgada
    previousExpiresAt: timestamp("previous_expires_at").notNull(),
    newExpiresAt: timestamp("new_expires_at").notNull(),
    extensionDuration: integer("extension_duration").notNull(), // ms

    // Justificación
    reason: text("reason").notNull(),

    // Aprobación
    approvedBy: uuid("approved_by").notNull(),
    approvedByName: varchar("approved_by_name", { length: 255 }).notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_support_extensions_access").on(table.originalAccessId),
    index("idx_support_extensions_request").on(table.requestId),
  ]
);

/**
 * Configuración de políticas JIT por tenant
 */
export const sigmaSupportJitPoliciesTable = pgTable(
  "sigma_support_jit_policies",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

    tenantId: uuid("tenant_id").notNull().unique(),

    // Políticas de aprobación
    requireApproval: boolean("require_approval").notNull().default(true),
    autoApproveForUrgency: varchar("auto_approve_for_urgency", { length: 20 }), // "critical" = auto-aprobar críticos

    // Límites de tiempo
    maxAccessDuration: integer("max_access_duration").notNull().default(7200000), // 2h en ms
    maxExtensions: integer("max_extensions").notNull().default(2), // Max 2 extensiones
    requestExpirationTime: integer("request_expiration_time").notNull().default(86400000), // 24h

    // Notificaciones
    notifyAdminsOnRequest: boolean("notify_admins_on_request").default(true),
    notifyAdminEmails: text("notify_admin_emails"), // Emails separados por coma

    // Restricciones de scope
    allowedScopes: jsonb("allowed_scopes").default({
      canViewLogs: true,
      canViewMetrics: true,
      canViewAudit: false,
      canExportData: false,
    }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_support_jit_policies_tenant").on(table.tenantId),
  ]
);

/**
 * Zod Schemas para validación
 */

export const insertSigmaSupportAccessRequestSchema = z.object({
  requestedBy: z.string().uuid(),
  requestedByName: z.string().min(1).max(255),
  requestedByEmail: z.string().email(),
  tenantId: z.string().uuid(),
  tenantNombre: z.string().min(1).max(255),
  reason: z.string().min(10).max(1000),
  estimatedDuration: z.number().int().min(1800000).max(14400000), // 30min - 4h
  urgency: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  scopeRequested: z.object({
    canViewLogs: z.boolean(),
    canViewMetrics: z.boolean(),
    canViewAudit: z.boolean(),
    canExportData: z.boolean(),
  }),
});

export const reviewAccessRequestSchema = z.object({
  requestId: z.string().uuid(),
  approved: z.boolean(),
  reviewNotes: z.string().max(500).optional(),
  customDuration: z.number().int().min(1800000).max(7200000).optional(), // 30min - 2h
});

export const extendAccessRequestSchema = z.object({
  accessId: z.string().uuid(),
  reason: z.string().min(10).max(500),
  extensionDuration: z.number().int().min(1800000).max(7200000), // 30min - 2h
});

export const updateJitPolicySchema = z.object({
  tenantId: z.string().uuid(),
  requireApproval: z.boolean().optional(),
  autoApproveForUrgency: z.enum(["critical", "none"]).optional(),
  maxAccessDuration: z.number().int().min(1800000).max(14400000).optional(),
  maxExtensions: z.number().int().min(0).max(5).optional(),
  notifyAdminsOnRequest: z.boolean().optional(),
  notifyAdminEmails: z.string().optional(),
  allowedScopes: z.object({
    canViewLogs: z.boolean(),
    canViewMetrics: z.boolean(),
    canViewAudit: z.boolean(),
    canExportData: z.boolean(),
  }).optional(),
});

export type SigmaSupportAccessRequest = typeof sigmaSupportAccessRequestsTable.$inferSelect;
export type NewSigmaSupportAccessRequest = typeof sigmaSupportAccessRequestsTable.$inferInsert;
export type SigmaSupportAccessExtension = typeof sigmaSupportAccessExtensionsTable.$inferSelect;
export type SigmaSupportJitPolicy = typeof sigmaSupportJitPoliciesTable.$inferSelect;
