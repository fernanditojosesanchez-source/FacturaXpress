/**
 * Schema para Sincronización de Catálogos DGII
 * 
 * Tracks de versiones de catálogos y registro de sincronizaciones.
 * Implementa estrategia de verificación contra servidor DGII cada 24h.
 * 
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #6 (P1: Catálogos DGII desactualizados)
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, uuid, boolean, integer, index, jsonb, unique } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * Tabla de versiones de catálogos
 * Registra el estado de sincronización de cada catálogo con DGII
 */
export const catalogVersionsTable = pgTable(
  "catalog_versions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    
    // Identificación del catálogo
    catalogName: varchar("catalog_name", { length: 50 }).notNull(), // departamentos, tipos_documento, tipos_dte, etc.
    version: varchar("version", { length: 20 }).notNull(), // Semver: 1.0.0
    
    // Metadata del catálogo
    description: text("description"), // "Departamentos de El Salvador"
    recordCount: integer("record_count").notNull().default(0), // Cantidad de registros
    
    // Sincronización
    lastSyncAt: timestamp("last_sync_at").notNull().defaultNow(),
    syncStatus: varchar("sync_status", { length: 20 }).notNull().default("success"), // success, failed, pending, skipped
    syncDurationMs: integer("sync_duration_ms"), // Tiempo que tardó la sincronización
    
    // Datos del catálogo
    data: jsonb("data").notNull().default([]), // Array de registros del catálogo
    dataHash: varchar("data_hash", { length: 64 }), // SHA256 del contenido para detectar cambios
    
    // Error logging
    error: text("error"), // Mensaje de error si syncStatus = failed
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Índices para optimizar queries
    index("idx_catalog_versions_name").on(table.catalogName),
    index("idx_catalog_versions_status").on(table.syncStatus, table.lastSyncAt),
    // Constraint de unicidad
    unique("unq_catalog_name_version").on(table.catalogName, table.version),
  ]
);

/**
 * Tabla de historial de sincronizaciones
 * Log detallado de cada intento de sincronización
 */
export const catalogSyncHistoryTable = pgTable(
  "catalog_sync_history",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    
    // Qué se sincronizó
    catalogName: varchar("catalog_name", { length: 50 }).notNull(),
    
    // Resultado
    status: varchar("status", { length: 20 }).notNull(), // success, failed, skipped
    message: text("message"), // Resumen de lo que pasó
    
    // Números
    oldRecordCount: integer("old_record_count"),
    newRecordCount: integer("new_record_count"),
    changedRecords: integer("changed_records").default(0), // Cuántos registros cambiaron
    
    // Timing
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
    
    // Debugging
    error: text("error"),
    stackTrace: text("stack_trace"),
    
    // Metadata
    triggerType: varchar("trigger_type", { length: 20 }).notNull().default("auto"), // auto, manual, retry
    triggeredBy: uuid("triggered_by"), // User ID si fue manual
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_catalog_sync_history_catalog").on(table.catalogName, table.createdAt),
    index("idx_catalog_sync_history_status").on(table.status),
  ]
);

/**
 * Tabla de alertas de sincronización
 * Notificaciones cuando hay fallos o cambios importantes
 */
export const catalogSyncAlertsTable = pgTable(
  "catalog_sync_alerts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    
    // Qué falló
    catalogName: varchar("catalog_name", { length: 50 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull(), // info, warning, error, critical
    
    // Alerta
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    
    // Recomendación
    recommendation: text("recommendation"), // Qué hacer para resolver
    
    // Estado
    acknowledged: boolean("acknowledged").default(false),
    acknowledgedAt: timestamp("acknowledged_at"),
    acknowledgedBy: uuid("acknowledged_by"),
    
    // Notificación
    notificationSent: boolean("notification_sent").default(false),
    notificationSentAt: timestamp("notification_sent_at"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("idx_catalog_sync_alerts_catalog").on(table.catalogName),
    index("idx_catalog_sync_alerts_severity").on(table.severity, table.createdAt),
  ]
);

/**
 * Zod Schemas para validación
 */

export const catalogSyncRequestSchema = z.object({
  catalogName: z.enum([
    "departamentos",
    "tipos_documento",
    "tipos_dte",
    "condiciones_operacion",
    "formas_pago",
    "unidades_medida",
  ]),
  force: z.boolean().default(false), // Forzar sync incluso si no hay cambios
});

export const catalogVersionSchema = z.object({
  catalogName: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semver
  recordCount: z.number().int().nonnegative(),
  dataHash: z.string().length(64), // SHA256
});

export type CatalogVersion = typeof catalogVersionsTable.$inferSelect;
export type NewCatalogVersion = typeof catalogVersionsTable.$inferInsert;
export type CatalogSyncHistory = typeof catalogSyncHistoryTable.$inferSelect;
export type CatalogSyncAlert = typeof catalogSyncAlertsTable.$inferSelect;
