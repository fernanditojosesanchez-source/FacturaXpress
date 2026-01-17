/**
 * Vista Soporte Sigma - Interfaz de monitoreo sin PII
 * Dashboard para equipo de soporte con logs, métricas y auditoría
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, uuid, boolean, integer, index } from "drizzle-orm/pg-core";

export const sigmaSupportAccessTable = pgTable(
  "sigma_support_access",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    
    // Datos del soporte (Sigma)
    supportUserId: uuid("support_user_id").notNull(),
    supportUserName: varchar("support_user_name", { length: 255 }).notNull(),
    supportEmail: varchar("support_email", { length: 255 }).notNull(),
    
    // Tenant que puede ver
    tenantId: uuid("tenant_id").notNull(),
    tenantNombre: varchar("tenant_nombre", { length: 255 }).notNull(),
    
    // Permisos
    tipoAcceso: varchar("tipo_acceso", { length: 50 }).notNull().default("readonly"),
    // readonly, readwrite, fullaccess
    
    // Scope de vista
    canViewLogs: boolean("can_view_logs").default(true),
    canViewMetrics: boolean("can_view_metrics").default(true),
    canViewAudit: boolean("can_view_audit").default(true),
    canExportData: boolean("can_export_data").default(false),
    
    // Acceso temporal
    fechaInicio: timestamp("fecha_inicio").notNull(),
    fechaFin: timestamp("fecha_fin"),
    activo: boolean("activo").default(true),
    
    // Razón de acceso
    razon: varchar("razon", { length: 255 }).notNull(),
    
    // Auditoría
    otorgadoPor: uuid("otorgado_por").notNull(),
    revisadoPor: uuid("revisado_por"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    index("idx_sigma_support_access_user").on(table.supportUserId),
    index("idx_sigma_support_access_tenant").on(table.tenantId),
    index("idx_sigma_support_access_active").on(table.activo, table.fechaFin),
  ]
);

export const sigmaSupportLogsTable = pgTable(
  "sigma_support_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    
    // Quien accedió
    supportUserId: uuid("support_user_id").notNull(),
    supportUserName: varchar("support_user_name", { length: 255 }).notNull(),
    
    // Qué hizo
    accion: varchar("accion", { length: 100 }).notNull(),
    // view_logs, view_metrics, export, download, debug
    
    // En qué recurso
    recurso: varchar("recurso", { length: 100 }).notNull(),
    // facturas, transmisions, certificados, etc.
    
    // Dato sin PII (ej: UUID, no nombre de cliente)
    resourceId: uuid("resource_id"),
    
    // Detalles sanitizados (sin datos sensibles)
    detalles: text("detalles"),
    
    // Resultado
    exitoso: boolean("exitoso").default(true),
    error: text("error"),
    
    // Timestamp
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_sigma_support_logs_user").on(table.supportUserId),
    index("idx_sigma_support_logs_accion").on(table.accion),
    index("idx_sigma_support_logs_fecha").on(table.createdAt),
  ]
);

export const sigmaSupportMetricasTable = pgTable(
  "sigma_support_metricas",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    
    // Tenant
    tenantId: uuid("tenant_id").notNull(),
    tenantNombre: varchar("tenant_nombre", { length: 255 }).notNull(),
    
    // Métrica
    metrica: varchar("metrica", { length: 100 }).notNull(),
    // facturas_totales, transmisiones_exitosas, certificados_expirando, etc.
    
    // Valor (numérico)
    valor: integer("valor").notNull(),
    
    // Período
    periodo: varchar("periodo", { length: 20 }).notNull().default("daily"), // daily, weekly, monthly
    fecha: timestamp("fecha").notNull().defaultNow(),
    
    // Análisis
    trending: varchar("trending", { length: 10 }), // up, down, stable
    alerta: boolean("alerta").default(false),
    
    // Timestamp
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_sigma_support_metricas_tenant").on(table.tenantId),
    index("idx_sigma_support_metricas_tipo").on(table.metrica),
    index("idx_sigma_support_metricas_fecha").on(table.fecha),
  ]
);

export const sigmaSupportTicketsTable = pgTable(
  "sigma_support_tickets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    
    // Ticket
    numeroTicket: varchar("numero_ticket", { length: 50 }).unique().notNull(),
    
    // Tenant
    tenantId: uuid("tenant_id").notNull(),
    tenantNombre: varchar("tenant_nombre", { length: 255 }).notNull(),
    
    // Problema
    titulo: varchar("titulo", { length: 255 }).notNull(),
    descripcion: text("descripcion").notNull(),
    categoria: varchar("categoria", { length: 50 }).notNull(),
    // facturas, certificados, transmisiones, performance, etc.
    
    // Severidad
    severidad: varchar("severidad", { length: 20 }).notNull().default("normal"),
    // baja, normal, alta, critica
    
    // Estado
    estado: varchar("estado", { length: 50 }).notNull().default("abierto"),
    // abierto, en_progreso, resuelto, cerrado
    
    // Asignación
    asignadoA: uuid("asignado_a"),
    asignadoNombre: varchar("asignado_nombre", { length: 255 }),
    
    // Resolución
    solucion: text("solucion"),
    fechaResolucion: timestamp("fecha_resolucion"),
    
    // Auditoría
    creadoPor: uuid("creado_por").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    closedAt: timestamp("closed_at"),
  },
  (table) => [
    index("idx_sigma_support_tickets_tenant").on(table.tenantId),
    index("idx_sigma_support_tickets_estado").on(table.estado),
    index("idx_sigma_support_tickets_numero").on(table.numeroTicket),
    index("idx_sigma_support_tickets_severidad").on(table.severidad),
  ]
);
