import { db } from "../db.js";
import { 
  featureFlags, 
  featureFlagHistory, 
  featureFlagEvaluations,
  type FeatureFlag,
  type FeatureFlagEvaluationResult,
  type FeatureFlagBulkEvaluationResult
} from "../../shared/schema-feature-flags.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Feature Flags Service
 * 
 * Maneja la lógica de evaluación de feature flags con diferentes estrategias:
 * - Boolean: simple on/off
 * - Percentage: rollout por porcentaje
 * - Tenants: lista específica de tenants
 * - User IDs: lista específica de usuarios
 * - Gradual: liberación gradual automática
 */

interface EvaluationContext {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  customAttributes?: Record<string, any>;
}

export class FeatureFlagsService {
  /**
   * Evalúa si un feature flag está habilitado para un contexto dado
   */
  async isEnabled(
    flagKey: string,
    context: EvaluationContext = {}
  ): Promise<boolean> {
    try {
      const result = await this.evaluate(flagKey, context);
      return result.enabled;
    } catch (error) {
      logger.error(`Error evaluando feature flag ${flagKey}:`, error);
      return false; // Fail closed: si hay error, feature deshabilitado
    }
  }

  /**
   * Evalúa un feature flag y retorna resultado detallado
   */
  async evaluate(
    flagKey: string,
    context: EvaluationContext = {}
  ): Promise<FeatureFlagEvaluationResult> {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, flagKey),
    });

    if (!flag) {
      logger.warn(`Feature flag no encontrado: ${flagKey}`);
      return {
        enabled: false,
        key: flagKey,
        strategy: "not_found",
      };
    }

    // Verificar toggle maestro
    if (!flag.habilitado) {
      await this.logEvaluation(flag.id, context, false, "disabled");
      return {
        enabled: false,
        key: flagKey,
        strategy: flag.estrategia,
      };
    }

    // Verificar fechas automáticas
    const now = new Date();
    if (flag.inicioAutomatico && now < flag.inicioAutomatico) {
      await this.logEvaluation(flag.id, context, false, "before_start_date");
      return { enabled: false, key: flagKey, strategy: flag.estrategia };
    }
    if (flag.finAutomatico && now > flag.finAutomatico) {
      await this.logEvaluation(flag.id, context, false, "after_end_date");
      return { enabled: false, key: flagKey, strategy: flag.estrategia };
    }

    // Evaluar según estrategia
    let enabled = false;
    const flagAsAny = flag as any; // Type cast para evitar error de tipos con unknown
    switch (flag.estrategia) {
      case "boolean":
        enabled = true; // Si llegó aquí, habilitado = true
        break;
      
      case "percentage":
        enabled = this.evaluatePercentage(flagAsAny, context);
        break;
      
      case "tenants":
        enabled = this.evaluateTenants(flagAsAny, context);
        break;
      
      case "user_ids":
        enabled = this.evaluateUserIds(flagAsAny, context);
        break;
      
      case "gradual":
        enabled = this.evaluateGradual(flagAsAny, context);
        break;
      
      default:
        enabled = false;
    }

    // Actualizar métricas
    await this.updateMetrics(flag.id, enabled);
    
    // Log de evaluación
    await this.logEvaluation(flag.id, context, enabled, flag.estrategia);

    return {
      enabled,
      key: flagKey,
      strategy: flag.estrategia,
      config: flag.configuracion as Record<string, any>,
    };
  }

  /**
   * Evalúa múltiples flags de una vez (bulk)
   */
  async evaluateBulk(
    flagKeys: string[],
    context: EvaluationContext = {}
  ): Promise<FeatureFlagBulkEvaluationResult> {
    const results = await Promise.all(
      flagKeys.map(key => this.evaluate(key, context))
    );

    const flags: Record<string, boolean> = {};
    const configs: Record<string, any> = {};

    results.forEach((result: FeatureFlagEvaluationResult) => {
      flags[result.key] = result.enabled;
      if (result.config) {
        configs[result.key] = result.config;
      }
    });

    return { flags, configs };
  }

  /**
   * Obtiene todos los flags activos para un contexto (para frontend)
   */
  async getAllFlags(context: EvaluationContext = {}): Promise<Record<string, boolean>> {
    const allFlags = await db.query.featureFlags.findMany({
      where: eq(featureFlags.habilitado, true),
    });

    const results: Record<string, boolean> = {};
    
    for (const flag of allFlags) {
      const evaluation = await this.evaluate(flag.key, context);
      results[flag.key] = evaluation.enabled;
    }

    return results;
  }

  /**
   * Estrategia: Percentage
   * Usa hash determinístico para consistencia
   */
  private evaluatePercentage(flag: FeatureFlag, context: EvaluationContext): boolean {
    if (!flag.porcentajeRollout || flag.porcentajeRollout === 0) return false;
    if (flag.porcentajeRollout === 100) return true;

    // Usar tenantId o userId para hash determinístico
    const identifier = context.tenantId || context.userId || "anonymous";
    const hash = this.simpleHash(flag.key + identifier);
    const bucket = hash % 100;

    return bucket < flag.porcentajeRollout;
  }

  /**
   * Estrategia: Tenants
   * Solo para tenants específicos en la lista
   */
  private evaluateTenants(flag: FeatureFlag, context: EvaluationContext): boolean {
    if (!context.tenantId) return false;
    const permitidos = (flag.tenantsPermitidos as string[]) || [];
    return permitidos.includes(context.tenantId);
  }

  /**
   * Estrategia: User IDs
   * Solo para usuarios específicos
   */
  private evaluateUserIds(flag: FeatureFlag, context: EvaluationContext): boolean {
    if (!context.userId) return false;
    const permitidos = (flag.usuariosPermitidos as string[]) || [];
    return permitidos.includes(context.userId);
  }

  /**
   * Estrategia: Gradual
   * Similar a percentage, pero con incremento automático del porcentaje
   */
  private evaluateGradual(flag: FeatureFlag, context: EvaluationContext): boolean {
    return this.evaluatePercentage(flag, context);
  }

  /**
   * Hash simple para distribución uniforme
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Actualiza métricas del flag
   */
  private async updateMetrics(flagId: string, enabled: boolean): Promise<void> {
    try {
      await db.update(featureFlags)
        .set({
          vecesConsultado: sql`${featureFlags.vecesConsultado} + 1`,
          ...(enabled 
            ? { vecesActivado: sql`${featureFlags.vecesActivado} + 1` }
            : { vecesDesactivado: sql`${featureFlags.vecesDesactivado} + 1`}
          ),
          ultimaConsulta: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(featureFlags.id, flagId));
    } catch (error) {
      // No-op: métricas no deberían bloquear evaluación
      logger.debug("Error actualizando métricas de feature flag:", error);
    }
  }

  /**
   * Registra evaluación para analytics (sampling: 10%)
   */
  private async logEvaluation(
    flagId: string,
    context: EvaluationContext,
    resultado: boolean,
    estrategiaUsada: string
  ): Promise<void> {
    try {
      // Sampling: solo log 10% de las evaluaciones para no saturar BD
      if (Math.random() > 0.1) return;

      await db.insert(featureFlagEvaluations).values({
        flagId,
        tenantId: context.tenantId,
        userId: context.userId,
        resultado,
        estrategiaUsada,
      });
    } catch (error) {
      // No-op: logging no debería bloquear evaluación
      logger.debug("Error logging evaluación de feature flag:", error);
    }
  }

  /**
   * Crea o actualiza un feature flag
   */
  async upsertFlag(
    key: string,
    data: Partial<FeatureFlag>,
    modificadoPor: string
  ): Promise<FeatureFlag> {
    const existing = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, key),
    });

    if (existing) {
      // Actualizar
      const [updated] = await db.update(featureFlags)
        .set({
          ...data,
          modificadoPor,
          updatedAt: new Date(),
        })
        .where(eq(featureFlags.id, existing.id))
        .returning();

      // Log de cambios
      await this.logChanges(existing as any, updated as any, modificadoPor);

      return updated as any;
    } else {
      // Crear
      const [created] = await db.insert(featureFlags)
        .values({
          key,
          ...data,
          creadoPor: modificadoPor,
        } as any)
        .returning();

      return created as any;
    }
  }

  /**
   * Registra cambios en historial
   */
  private async logChanges(
    anterior: FeatureFlag,
    nuevo: FeatureFlag,
    modificadoPor: string
  ): Promise<void> {
    const cambios: Array<{ campo: string; valorAnterior: string; valorNuevo: string }> = [];

    // Comparar campos relevantes
    const camposAComparar: Array<keyof FeatureFlag> = [
      "habilitado",
      "estrategia",
      "porcentajeRollout",
      "tenantsPermitidos",
      "usuariosPermitidos",
      "configuracion",
    ];

    for (const campo of camposAComparar) {
      const valorAnterior = anterior[campo];
      const valorNuevo = nuevo[campo];

      if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
        cambios.push({
          campo: campo.toString(),
          valorAnterior: JSON.stringify(valorAnterior),
          valorNuevo: JSON.stringify(valorNuevo),
        });
      }
    }

    // Insertar cambios en historial
    if (cambios.length > 0) {
      await db.insert(featureFlagHistory).values(
        cambios.map(c => ({
          flagId: anterior.id,
          modificadoPor,
          ...c,
        }))
      );
    }
  }

  /**
   * Incrementa gradualmente el porcentaje de rollout
   */
  async incrementGradualRollout(
    flagKey: string,
    incremento: number = 10,
    modificadoPor: string
  ): Promise<FeatureFlag> {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, flagKey),
    });

    if (!flag) {
      throw new Error(`Feature flag no encontrado: ${flagKey}`);
    }

    const nuevoRollout = Math.min(100, (flag.porcentajeRollout || 0) + incremento);

    return this.upsertFlag(
      flagKey,
      { porcentajeRollout: nuevoRollout },
      modificadoPor
    );
  }

  /**
   * Obtiene historial de cambios de un flag
   */
  async getHistory(flagKey: string): Promise<typeof featureFlagHistory.$inferSelect[]> {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, flagKey),
    });

    if (!flag) return [];

    return db.query.featureFlagHistory.findMany({
      where: eq(featureFlagHistory.flagId, flag.id),
      orderBy: [desc(featureFlagHistory.createdAt)],
      limit: 100,
    });
  }

  /**
   * Obtiene estadísticas de uso de un flag
   */
  async getStats(flagKey: string, days: number = 7) {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, flagKey),
    });

    if (!flag) {
      throw new Error(`Feature flag no encontrado: ${flagKey}`);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const evaluations = await db.query.featureFlagEvaluations.findMany({
      where: and(
        eq(featureFlagEvaluations.flagId, flag.id),
        sql`${featureFlagEvaluations.createdAt} >= ${cutoffDate}`
      ),
    });

    const totalEvaluations = evaluations.length;
    const enabledCount = evaluations.filter((e: any) => e.resultado).length;
    const uniqueTenants = new Set(evaluations.map((e: any) => e.tenantId).filter(Boolean)).size;
    const uniqueUsers = new Set(evaluations.map((e: any) => e.userId).filter(Boolean)).size;

    return {
      flagKey,
      totalEvaluations,
      enabledCount,
      disabledCount: totalEvaluations - enabledCount,
      enabledPercentage: totalEvaluations > 0 ? (enabledCount / totalEvaluations) * 100 : 0,
      uniqueTenants,
      uniqueUsers,
      period: `${days} days`,
    };
  }

  /**
   * PHASE 2: Incrementa el rollout gradualmente (canary deployment)
   * Usado para liberación automática: 0% -> 10% -> 25% -> 50% -> 100%
   */
  async incrementRollout(
    flagKey: string,
    incremento: number = 10,
    userId: string = "system"
  ): Promise<FeatureFlag> {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, flagKey),
    });

    if (!flag) {
      throw new Error(`Feature flag no encontrado: ${flagKey}`);
    }

    if (flag.estrategia !== "percentage" && flag.estrategia !== "gradual") {
      throw new Error(
        `No se puede incrementar rollout para estrategia ${flag.estrategia}`
      );
    }

    const newPorcentaje = Math.min(100, (flag.porcentajeRollout || 0) + incremento);

    const updated = await db
      .update(featureFlags)
      .set({
        porcentajeRollout: newPorcentaje,
        modificadoPor: userId,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.id, flag.id))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      throw new Error(`No se pudo actualizar feature flag ${flagKey}`);
    }

    // Registrar en historial
    await db.insert(featureFlagHistory).values({
      flagId: flag.id,
      campo: "porcentajeRollout",
      valorAnterior: (flag.porcentajeRollout || 0).toString(),
      valorNuevo: newPorcentaje.toString(),
      modificadoPor: userId,
      motivo: `Incremento automático de rollout: ${flag.porcentajeRollout}% -> ${newPorcentaje}%`,
    });

    return updated as FeatureFlag;
  }

  /**
   * PHASE 2: Procesa rollouts automáticos (canary deployment)
   * Se ejecuta periódicamente (ej: cada 15 minutos)
   * Incrementa gradualmente el porcentaje de usuarios afectados
   */
  async processAutomaticRollouts(): Promise<{
    processed: number;
    updated: number;
  }> {
    const now = new Date();

    // Buscar flags con estrategia 'gradual' habilitados
    const gradualFlags = await db.query.featureFlags.findMany({
      where: and(
        eq(featureFlags.estrategia, "gradual"),
        eq(featureFlags.habilitado, true)
      ),
    });

    let updated = 0;
    for (const flag of gradualFlags) {
      try {
        // Verificar si debe incrementarse (últimas 15 min sin cambios)
        const lastUpdate = flag.ultimaConsulta || flag.updatedAt;
        const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

        if (minutesSinceUpdate >= 15 && flag.porcentajeRollout! < 100) {
          // Incrementar 10% automáticamente
          await this.incrementRollout(flag.key, 10, "system:auto-rollout");
          updated++;

          logger.info(`Canary deployment for ${flag.key}: ${flag.porcentajeRollout}% -> ${Math.min(100, flag.porcentajeRollout! + 10)}%`);
        }
      } catch (err) {
        logger.error(`Error en rollout automático para flag ${flag.key}:`, err);
      }
    }

    return {
      processed: gradualFlags.length,
      updated,
    };
  }

  /**
   * PHASE 2: Obtiene el estado de un rollout gradual
   */
  async getRolloutStatus(flagKey: string) {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, flagKey),
    });

    if (!flag) {
      throw new Error(`Feature flag no encontrado: ${flagKey}`);
    }

    if (flag.estrategia !== "percentage" && flag.estrategia !== "gradual") {
      return {
        flagKey,
        estrategia: flag.estrategia,
        mensaje: "Este flag no usa estrategia de rollout por porcentaje",
      };
    }

    const stats = await this.getStats(flagKey, 1);

    return {
      flagKey,
      estrategia: flag.estrategia,
      porcentaje: flag.porcentajeRollout,
      habilitado: flag.habilitado,
      stats: {
        totalEvaluaciones: stats.totalEvaluations,
        activado: stats.enabledCount,
        desactivado: stats.disabledCount,
        porcentajeActivado: stats.enabledPercentage,
      },
      proximoIncremento: flag.estrategia === "gradual" ? "+10%" : "manual",
    };
  }

  /**
   * PHASE 2: Lista los rollout en progreso (canary deployments)
   */
  async getActiveRollouts() {
    const gradualFlags = await db.query.featureFlags.findMany({
      where: and(
        eq(featureFlags.estrategia, "gradual"),
        eq(featureFlags.habilitado, true)
      ),
      orderBy: [desc(featureFlags.porcentajeRollout)],
    });

    const rollouts = [];
    for (const flag of gradualFlags) {
      const stats = await this.getStats(flag.key, 1);
      rollouts.push({
        key: flag.key,
        nombre: flag.nombre,
        porcentaje: flag.porcentajeRollout,
        usuarios: stats.uniqueUsers,
        tenants: stats.uniqueTenants,
        estado: flag.porcentajeRollout === 100 ? "completado" : "en progreso",
      });
    }

    return rollouts;
  }
}

// Singleton instance
export const featureFlagsService = new FeatureFlagsService();
