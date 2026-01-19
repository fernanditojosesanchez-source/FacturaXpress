import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, boolean, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenants } from "./schema.ts";

/**
 * Feature Flags Schema - Sistema de control de features y rollout gradual
 * 
 * Este sistema permite:
 * - Activar/desactivar features dinámicamente
 * - Rollout por porcentaje de usuarios
 * - Rollout por tenant específico
 * - Canary deployments
 * - A/B testing
 */

// Tabla principal de feature flags
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Identificación
  key: text("key").notNull().unique(), // Ej: "stock_transito", "factura_electronica_v2"
  nombre: text("nombre").notNull(), // Nombre amigable
  descripcion: text("descripcion"),
  categoria: text("categoria").default("feature"), // feature, experiment, killswitch, config
  
  // Estado global
  habilitado: boolean("habilitado").default(false), // Toggle maestro
  
  // Estrategia de rollout
  estrategia: text("estrategia").notNull().default("boolean"), 
  // Estrategias:
  //   - boolean: simple on/off
  //   - percentage: por porcentaje de usuarios
  //   - tenants: lista específica de tenants
  //   - user_ids: lista específica de usuarios
  //   - gradual: liberación gradual automática
  
  // Configuración de porcentaje (para estrategia percentage/gradual)
  porcentajeRollout: integer("porcentaje_rollout").default(0), // 0-100
  
  // Lista de tenants permitidos (para estrategia tenants)
  tenantsPermitidos: jsonb("tenants_permitidos").default([]), // ["uuid1", "uuid2"]
  
  // Lista de usuarios permitidos (para estrategia user_ids)
  usuariosPermitidos: jsonb("usuarios_permitidos").default([]), // ["uuid1", "uuid2"]
  
  // Configuración adicional
  configuracion: jsonb("configuracion").default({}), 
  // Puede contener cualquier config específica:
  // { "max_items": 100, "timeout_ms": 5000, "variant": "A" }
  
  // Fechas de activación/desactivación automática
  inicioAutomatico: timestamp("inicio_automatico"),
  finAutomatico: timestamp("fin_automatico"),
  
  // Métricas y estado
  vecesConsultado: integer("veces_consultado").default(0),
  vecesActivado: integer("veces_activado").default(0),
  vecesDesactivado: integer("veces_desactivado").default(0),
  ultimaConsulta: timestamp("ultima_consulta"),
  
  // Metadatos
  creadoPor: varchar("creado_por"), // UUID del usuario que creó el flag
  modificadoPor: varchar("modificado_por"),
  tags: jsonb("tags").default([]), // ["beta", "experimental", "phase-2"]
  
  // Auditoría
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  idx_key: index("idx_feature_flags_key").on(t.key),
  idx_habilitado: index("idx_feature_flags_habilitado").on(t.habilitado),
  idx_categoria: index("idx_feature_flags_categoria").on(t.categoria),
  idx_estrategia: index("idx_feature_flags_estrategia").on(t.estrategia),
}));

// Tabla de historial de cambios en feature flags
export const featureFlagHistory = pgTable("feature_flag_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  flagId: uuid("flag_id").references(() => featureFlags.id).notNull(),
  
  // Cambio realizado
  campo: text("campo").notNull(), // "habilitado", "porcentaje_rollout", etc.
  valorAnterior: text("valor_anterior"),
  valorNuevo: text("valor_nuevo"),
  
  // Contexto
  modificadoPor: varchar("modificado_por").notNull(),
  motivo: text("motivo"), // Razón del cambio
  
  // Auditoría
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idx_flagId: index("idx_feature_flag_history_flagId").on(t.flagId),
  idx_createdAt: index("idx_feature_flag_history_createdAt").on(t.createdAt),
}));

// Tabla de evaluaciones de feature flags (para analytics)
export const featureFlagEvaluations = pgTable("feature_flag_evaluations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  flagId: uuid("flag_id").references(() => featureFlags.id).notNull(),
  
  // Contexto de la evaluación
  tenantId: uuid("tenant_id").references(() => tenants.id),
  userId: varchar("user_id"),
  
  // Resultado
  resultado: boolean("resultado").notNull(), // true = feature activado, false = desactivado
  estrategiaUsada: text("estrategia_usada"),
  
  // Metadata
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  
  // Timestamp
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idx_flagId: index("idx_feature_flag_evaluations_flagId").on(t.flagId),
  idx_tenantId: index("idx_feature_flag_evaluations_tenantId").on(t.tenantId),
  idx_createdAt: index("idx_feature_flag_evaluations_createdAt").on(t.createdAt),
  idx_flag_tenant: index("idx_feature_flag_evaluations_flag_tenant").on(t.flagId, t.tenantId),
}));

// Zod schemas para validación
export const insertFeatureFlagSchema = createInsertSchema(featureFlags).extend({
  key: z.string().min(3).max(100).regex(/^[a-z0-9_]+$/, "Solo letras minúsculas, números y guiones bajos"),
  nombre: z.string().min(3).max(200),
  estrategia: z.enum(["boolean", "percentage", "tenants", "user_ids", "gradual"]),
  porcentajeRollout: z.number().min(0).max(100).optional(),
  tenantsPermitidos: z.array(z.string().uuid()).optional(),
  usuariosPermitidos: z.array(z.string().uuid()).optional(),
});

export const updateFeatureFlagSchema = insertFeatureFlagSchema.partial();

export const selectFeatureFlagSchema = createSelectSchema(featureFlags);

export type FeatureFlag = z.infer<typeof selectFeatureFlagSchema>;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type UpdateFeatureFlag = z.infer<typeof updateFeatureFlagSchema>;

// Schema para historial
export const insertFeatureFlagHistorySchema = createInsertSchema(featureFlagHistory);
export type FeatureFlagHistory = typeof featureFlagHistory.$inferSelect;

// Schema para evaluaciones
export const insertFeatureFlagEvaluationSchema = createInsertSchema(featureFlagEvaluations);
export type FeatureFlagEvaluation = typeof featureFlagEvaluations.$inferSelect;

// Tipos de respuesta para APIs
export type FeatureFlagEvaluationResult = {
  enabled: boolean;
  key: string;
  strategy: string;
  config?: Record<string, any>;
  variant?: string;
};

export type FeatureFlagBulkEvaluationResult = {
  flags: Record<string, boolean>;
  configs: Record<string, any>;
};
