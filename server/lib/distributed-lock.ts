/**
 * Distributed Lock Service (Redis-backed)
 * 
 * Implementa candados distribuidos usando Redis para sincronizar
 * procesos en múltiples instancias de Node.js (Kubernetes, Serverless, etc.)
 * 
 * @see AUDITORIA_CRITICA_2026.md - Hallazgo #2 (P0: Race Conditions)
 * 
 * Comportamiento:
 * - Adquiere lock con TTL auto-renovador
 * - Previene duplicación en procesamiento de Outbox
 * - Soporta retry con backoff exponencial
 * - Audita todas las adquisiciones para debugging
 */

import { getRedis } from "./redis.js";
import { log } from "../index.js";

/**
 * Opciones para adquisición de lock
 */
export interface LockOptions {
  ttlMs?: number;           // TTL del lock (default: 30s)
  maxWaitMs?: number;       // Max tiempo esperando el lock (default: 5s)
  retryIntervalMs?: number; // Tiempo entre reintentos (default: 100ms)
  retryBackoff?: number;    // Multiplicador de backoff (default: 1.5)
  maxRetries?: number;      // Max reintentos (default: 50)
  autoRenew?: boolean;      // Auto-renovar lock mientras se usa (default: true)
}

/**
 * Resultado de intento de lock
 */
export interface LockResult {
  acquired: boolean;
  lockId: string;
  ttlMs: number;
  errorMessage?: string;
}

const DEFAULT_LOCK_TTL = 30000;      // 30 segundos
const DEFAULT_MAX_WAIT = 5000;       // 5 segundos
const DEFAULT_RETRY_INTERVAL = 100;  // 100ms
const DEFAULT_RETRY_BACKOFF = 1.5;   // 1.5x exponencial
const DEFAULT_MAX_RETRIES = 50;      // Max ~50s con backoff

/**
 * Servicio de Locks Distribuidos
 * 
 * Usa Redis SET con NX (Not eXists) + EX (EXpire) para implementar
 * locks atomicos. Genera UUIDs únicos para cada lock para asegurar
 * que solo el propietario puede liberar el lock.
 */
class DistributedLockService {
  private activeLocks = new Map<string, {
    lockId: string;
    renewalTimer?: NodeJS.Timeout;
    expiresAt: Date;
  }>();

  /**
   * Generar UUID único para el lock (identificador del propietario)
   */
  private generateLockId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Adquirir lock distribuido
   * 
   * @param lockKey - Clave única del recurso a proteger (ej: "outbox:processing")
   * @param options - Opciones de configuración
   * @returns LockResult con estado de adquisición
   */
  async acquireLock(lockKey: string, options: LockOptions = {}): Promise<LockResult> {
    const {
      ttlMs = DEFAULT_LOCK_TTL,
      maxWaitMs = DEFAULT_MAX_WAIT,
      retryIntervalMs = DEFAULT_RETRY_INTERVAL,
      retryBackoff = DEFAULT_RETRY_BACKOFF,
      maxRetries = DEFAULT_MAX_RETRIES,
      autoRenew = true,
    } = options;

    const lockId = this.generateLockId();
    const startTime = Date.now();
    let attemptCount = 0;
    let currentRetryInterval = retryIntervalMs;

    try {
      const redis = await getRedis();

      // Intentar adquirir lock con reintentos
      while (attemptCount < maxRetries) {
        const elapsed = Date.now() - startTime;
        
        if (elapsed > maxWaitMs) {
          log(
            `⏱️ Timeout esperando lock "${lockKey}" (elapsed: ${elapsed}ms)`,
            "lock"
          );
          return {
            acquired: false,
            lockId,
            ttlMs,
            errorMessage: `Timeout after ${elapsed}ms (maxWaitMs: ${maxWaitMs})`
          };
        }

        // Intentar SET con NX (solo si no existe) y EX (expiración)
        // Retorna "OK" si fue exitoso, null si ya existe
        const result = await redis.set(
          lockKey,
          lockId,
          {
            NX: true,
            EX: Math.ceil(ttlMs / 1000),
          }
        );

        if (result === "OK") {
          // ✅ Lock adquirido exitosamente
          const expiresAt = new Date(Date.now() + ttlMs);
          
          // Registrar lock activo
          this.activeLocks.set(lockKey, {
            lockId,
            expiresAt,
          });

          // Configurar auto-renewal si está habilitado
          if (autoRenew && ttlMs > 5000) {
            this.setupAutoRenewal(lockKey, lockId, ttlMs, redis);
          }

          log(
            `🔒 Lock adquirido: "${lockKey}" (TTL: ${ttlMs}ms, attemps: ${attemptCount})`,
            "lock"
          );

          return {
            acquired: true,
            lockId,
            ttlMs,
          };
        }

        // Lock no adquirido, esperar y reintentar
        attemptCount++;
        await new Promise(resolve => setTimeout(resolve, currentRetryInterval));
        
        // Backoff exponencial para siguiente intento
        currentRetryInterval = Math.min(
          currentRetryInterval * retryBackoff,
          1000 // Max 1 segundo entre reintentos
        );
      }

      // No se pudo adquirir después de maxRetries
      log(
        `❌ Failed to acquire lock "${lockKey}" after ${maxRetries} attempts`,
        "lock"
      );

      return {
        acquired: false,
        lockId,
        ttlMs,
        errorMessage: `Failed after ${maxRetries} attempts (totalTime: ${Date.now() - startTime}ms)`
      };
    } catch (error) {
      const msg = (error as Error).message;
      log(`❌ Error adquiriendo lock "${lockKey}": ${msg}`, "lock");
      return {
        acquired: false,
        lockId,
        ttlMs,
        errorMessage: msg,
      };
    }
  }

  /**
   * Configurar renovación automática del lock
   * Se ejecuta cada (ttlMs * 0.8) para asegurar que no expire
   */
  private setupAutoRenewal(
    lockKey: string,
    lockId: string,
    ttlMs: number,
    redis: any
  ): void {
    // Renovar cada 80% del TTL para estar seguro
    const renewalIntervalMs = Math.floor(ttlMs * 0.8);

    const renewalTimer = setInterval(async () => {
      try {
        // Renovar lock solo si aún lo poseemos
        const currentOwner = await redis.get(lockKey);
        
        if (currentOwner === lockId) {
          // Aún lo poseemos, renovar
          await redis.expire(lockKey, Math.ceil(ttlMs / 1000));
          // log(`🔄 Lock renovado: "${lockKey}"`, "lock");
        } else {
          // Ya no lo poseemos, detener renovación
          clearInterval(renewalTimer);
          this.activeLocks.delete(lockKey);
          log(`⚠️ Lock perdido (otro propietario): "${lockKey}"`, "lock");
        }
      } catch (error) {
        log(
          `⚠️ Error renovando lock "${lockKey}": ${(error as Error).message}`,
          "lock"
        );
      }
    }, renewalIntervalMs);

    // Guardar timer para limpieza posterior
    const lockInfo = this.activeLocks.get(lockKey);
    if (lockInfo) {
      lockInfo.renewalTimer = renewalTimer;
    }
  }

  /**
   * Liberar lock (debe ser propietario)
   */
  async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    try {
      const redis = await getRedis();

      // Verificar que somos propietarios del lock
      const currentOwner = await redis.get(lockKey);
      
      if (currentOwner !== lockId) {
        log(
          `⚠️ Intento de liberar lock "${lockKey}" sin ser propietario`,
          "lock"
        );
        return false;
      }

      // Usar UNLINK para borrado asincrónico más rápido
      await redis.unlink(lockKey);
      
      // Detener auto-renewal
      const lockInfo = this.activeLocks.get(lockKey);
      if (lockInfo?.renewalTimer) {
        clearInterval(lockInfo.renewalTimer);
      }
      this.activeLocks.delete(lockKey);

      log(`🔓 Lock liberado: "${lockKey}"`, "lock");
      return true;
    } catch (error) {
      log(`❌ Error liberando lock "${lockKey}": ${(error as Error).message}`, "lock");
      return false;
    }
  }

  /**
   * Extender TTL del lock (si aún lo poseemos)
   */
  async extendLock(lockKey: string, lockId: string, additionalMs: number): Promise<boolean> {
    try {
      const redis = await getRedis();
      const currentOwner = await redis.get(lockKey);

      if (currentOwner !== lockId) {
        return false;
      }

      await redis.expire(lockKey, Math.ceil(additionalMs / 1000));
      
      // Actualizar info local
      const lockInfo = this.activeLocks.get(lockKey);
      if (lockInfo) {
        lockInfo.expiresAt = new Date(Date.now() + additionalMs);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtener información del lock
   */
  async getLockInfo(lockKey: string): Promise<{ owner?: string; ttlSeconds?: number } | null> {
    try {
      const redis = await getRedis();
      const owner = await redis.get(lockKey);
      
      if (!owner) {
        return null;
      }

      const ttl = await redis.ttl(lockKey);
      return {
        owner: owner.substring(0, 8) + "...", // Truncado para privacidad
        ttlSeconds: ttl > 0 ? ttl : undefined,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Obtener métricas de locks activos
   */
  getMetrics() {
    return {
      activeLocks: this.activeLocks.size,
      locks: Array.from(this.activeLocks.entries()).map(([key, info]) => ({
        key,
        expiresAt: info.expiresAt.toISOString(),
        autoRenewing: !!info.renewalTimer,
      })),
    };
  }

  /**
   * Limpiar todos los locks al shutdown
   */
  async cleanup(): Promise<void> {
    try {
      const redis = await getRedis();

      for (const [lockKey, lockInfo] of this.activeLocks.entries()) {
        try {
          // Detener auto-renewal
          if (lockInfo.renewalTimer) {
            clearInterval(lockInfo.renewalTimer);
          }

          // Liberar lock
          const currentOwner = await redis.get(lockKey);
          if (currentOwner === lockInfo.lockId) {
            await redis.unlink(lockKey);
          }
        } catch (error) {
          // Ignorar errores de limpieza individual
        }
      }

      this.activeLocks.clear();
      log("✅ Distributed locks cleaned up", "lock");
    } catch (error) {
      log(`⚠️ Error cleaning up locks: ${(error as Error).message}`, "lock");
    }
  }
}

// Singleton instance
let lockService: DistributedLockService | null = null;

/**
 * Obtener instancia del servicio de locks
 */
export function getLockService(): DistributedLockService {
  if (!lockService) {
    lockService = new DistributedLockService();
    
    // Cleanup al shutdown
    process.on("SIGINT", async () => {
      if (lockService) {
        await lockService.cleanup();
      }
    });

    process.on("SIGTERM", async () => {
      if (lockService) {
        await lockService.cleanup();
      }
    });
  }
  return lockService;
}

export default getLockService();
