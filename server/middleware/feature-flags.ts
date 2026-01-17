import { Request, Response, NextFunction } from "express";
import { featureFlagsService } from "../lib/feature-flags-service.js";
import { logger } from "../lib/logger.js";

/**
 * Middleware para validar feature flags antes de ejecutar un endpoint
 * 
 * Uso:
 * router.get("/nueva-funcionalidad", requireFeature("stock_transito"), handler);
 */
export function requireFeature(flagKey: string, options: {
  failSilently?: boolean;
  customMessage?: string;
} = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = {
        tenantId: (req as any).tenantId,
        userId: (req as any).user?.id,
        userEmail: (req as any).user?.email,
      };

      const enabled = await featureFlagsService.isEnabled(flagKey, context);

      if (!enabled) {
        if (options.failSilently) {
          logger.info(`Feature ${flagKey} deshabilitado para tenant ${context.tenantId}`);
          return next();
        }

        const message = options.customMessage || 
          `Feature "${flagKey}" no está disponible. Contacte al administrador.`;

        return res.status(403).json({
          error: "feature_disabled",
          message,
          feature: flagKey,
        });
      }

      // Feature habilitado, continuar
      next();
    } catch (error) {
      logger.error(`Error verificando feature flag ${flagKey}:`, error);
      
      // Fail open en desarrollo, fail closed en producción
      if (process.env.NODE_ENV === "production") {
        return res.status(500).json({
          error: "feature_check_failed",
          message: "No se pudo verificar disponibilidad de la funcionalidad",
        });
      }
      
      next();
    }
  };
}

/**
 * Middleware para verificar múltiples features (requiere TODAS)
 * 
 * Uso:
 * router.get("/endpoint", requireAllFeatures(["feature_a", "feature_b"]), handler);
 */
export function requireAllFeatures(flagKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = {
        tenantId: (req as any).tenantId,
        userId: (req as any).user?.id,
        userEmail: (req as any).user?.email,
      };

      const results = await Promise.all(
        flagKeys.map(key => featureFlagsService.isEnabled(key, context))
      );

      const allEnabled = results.every((enabled: boolean) => enabled);

      if (!allEnabled) {
        const disabledFeatures = flagKeys.filter((_, index) => !results[index]);
        
        return res.status(403).json({
          error: "features_disabled",
          message: "Algunas funcionalidades requeridas no están disponibles",
          disabledFeatures,
        });
      }

      next();
    } catch (error) {
      logger.error("Error verificando múltiples feature flags:", error);
      
      if (process.env.NODE_ENV === "production") {
        return res.status(500).json({
          error: "feature_check_failed",
          message: "No se pudo verificar disponibilidad de las funcionalidades",
        });
      }
      
      next();
    }
  };
}

/**
 * Middleware para verificar múltiples features (requiere AL MENOS UNA)
 * 
 * Uso:
 * router.get("/endpoint", requireAnyFeature(["feature_a", "feature_b"]), handler);
 */
export function requireAnyFeature(flagKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = {
        tenantId: (req as any).tenantId,
        userId: (req as any).user?.id,
        userEmail: (req as any).user?.email,
      };

      const results = await Promise.all(
        flagKeys.map(key => featureFlagsService.isEnabled(key, context))
      );

      const anyEnabled = results.some((enabled: boolean) => enabled);

      if (!anyEnabled) {
        return res.status(403).json({
          error: "features_disabled",
          message: "No tienes acceso a ninguna de las funcionalidades alternativas",
          requiredOneOf: flagKeys,
        });
      }

      next();
    } catch (error) {
      logger.error("Error verificando feature flags alternativos:", error);
      
      if (process.env.NODE_ENV === "production") {
        return res.status(500).json({
          error: "feature_check_failed",
          message: "No se pudo verificar disponibilidad de las funcionalidades",
        });
      }
      
      next();
    }
  };
}

/**
 * Middleware para inyectar flags en el request
 * Útil para que el handler pueda verificar features sin hacer queries adicionales
 * 
 * Uso:
 * router.use(injectFeatureFlags(["stock_transito", "sigma_support"]));
 */
export function injectFeatureFlags(flagKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = {
        tenantId: (req as any).tenantId,
        userId: (req as any).user?.id,
        userEmail: (req as any).user?.email,
      };

      const bulkResult = await featureFlagsService.evaluateBulk(flagKeys, context);
      
      // Inyectar en request
      (req as any).features = bulkResult.flags;
      (req as any).featureConfigs = bulkResult.configs;

      next();
    } catch (error) {
      logger.error("Error inyectando feature flags:", error);
      // No-op: continuar sin flags
      (req as any).features = {};
      (req as any).featureConfigs = {};
      next();
    }
  };
}

/**
 * Helper para verificar feature desde un handler sin middleware
 * 
 * Uso dentro de un handler:
 * if (await checkFeature(req, "stock_transito")) { ... }
 */
export async function checkFeature(req: Request, flagKey: string): Promise<boolean> {
  const context = {
    tenantId: (req as any).tenantId,
    userId: (req as any).user?.id,
    userEmail: (req as any).user?.email,
  };

  return featureFlagsService.isEnabled(flagKey, context);
}

/**
 * Middleware para obtener configuración de un feature
 * Útil para features que tienen configuraciones variables
 * 
 * Ejemplo: feature "max_upload_size" con config { "size_mb": 100 }
 */
export async function getFeatureConfig(req: Request, flagKey: string): Promise<any> {
  const context = {
    tenantId: (req as any).tenantId,
    userId: (req as any).user?.id,
    userEmail: (req as any).user?.email,
  };

  const evaluation = await featureFlagsService.evaluate(flagKey, context);
  return evaluation.config || {};
}
