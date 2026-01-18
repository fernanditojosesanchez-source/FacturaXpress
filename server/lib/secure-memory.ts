/**
 * Secure Memory Management Service
 * 
 * Implementa limpieza segura de secretos en memoria para prevenir
 * extracción de certificados privados mediante heap dumps.
 * 
 * @see AUDITORIA_CRITICA_2026.md - Hallazgo #4 (P0: Memory Leaks)
 * 
 * Estrategia:
 * - Zero-fill buffers de secretos (buffer.fill(0) o crypto.randomFillSync())
 * - Destrucción explícita de references
 * - Force GC cuando sea apropiado
 * - Logging de limpieza para auditoría
 */

import crypto from 'crypto';
import { log } from '../index.js';

/**
 * Buffer seguro que se auto-limpia cuando se destruye
 */
class SecureBuffer {
  private buffer: Buffer;
  private isDestroyed = false;

  constructor(data: Buffer | string) {
    if (typeof data === 'string') {
      this.buffer = Buffer.from(data, 'utf-8');
    } else {
      this.buffer = Buffer.from(data);
    }
  }

  /**
   * Obtener contenido (copia, nunca la referencia original)
   */
  getData(): Buffer {
    if (this.isDestroyed) {
      throw new Error('SecureBuffer has been destroyed');
    }
    return Buffer.from(this.buffer);
  }

  /**
   * Obtener como string (solo si es texto)
   */
  getString(): string {
    if (this.isDestroyed) {
      throw new Error('SecureBuffer has been destroyed');
    }
    return this.buffer.toString('utf-8');
  }

  /**
   * Obtener como Base64
   */
  getBase64(): string {
    if (this.isDestroyed) {
      throw new Error('SecureBuffer has been destroyed');
    }
    return this.buffer.toString('base64');
  }

  /**
   * Limpiar seguramente (zero-fill)
   */
  destroy(): void {
    if (this.isDestroyed) return;

    try {
      // Zero-fill: llenar con ceros para sobrescribir datos anteriores
      crypto.randomFillSync(this.buffer);
      this.buffer.fill(0);
    } catch (error) {
      // Si crypto.randomFillSync falla, al menos hacer fill(0)
      this.buffer.fill(0);
    }

    this.isDestroyed = true;
  }

  /**
   * Usar buffer en operación y auto-limpiar después
   */
  async withScope<T>(
    fn: (buffer: Buffer) => Promise<T>
  ): Promise<T> {
    try {
      return await fn(this.getData());
    } finally {
      this.destroy();
    }
  }

  /**
   * Versión sincrónica de withScope
   */
  withScopeSync<T>(fn: (buffer: Buffer) => T): T {
    try {
      return fn(this.getData());
    } finally {
      this.destroy();
    }
  }

  /**
   * Destructor implícito
   */
  [Symbol.dispose](): void {
    this.destroy();
  }

  toJSON() {
    return '[SecureBuffer - contents redacted]';
  }

  toString() {
    return '[SecureBuffer - contents redacted]';
  }
}

/**
 * Servicio de limpieza segura de secretos
 */
class SecureMemoryService {
  private trackedBuffers = new WeakSet<SecureBuffer>();
  private stats = {
    buffersCreated: 0,
    buffersDestroyed: 0,
    bytesSecured: 0,
  };

  /**
   * Crear buffer seguro
   */
  createSecureBuffer(data: Buffer | string): SecureBuffer {
    const buffer = new SecureBuffer(data);
    this.trackedBuffers.add(buffer);
    this.stats.buffersCreated++;
    
    if (typeof data === 'string') {
      this.stats.bytesSecured += data.length;
    } else {
      this.stats.bytesSecured += data.length;
    }

    return buffer;
  }

  /**
   * Zero-fill un buffer existente
   */
  zeroFillBuffer(buffer: Buffer): void {
    try {
      // Intentar llenar con random primero (más seguro)
      crypto.randomFillSync(buffer);
    } catch (error) {
      // Fallback a fill(0)
    }
    buffer.fill(0);
  }

  /**
   * Limpiar múltiples buffers
   */
  zeroFillMultiple(...buffers: Buffer[]): void {
    for (const buffer of buffers) {
      this.zeroFillBuffer(buffer);
    }
  }

  /**
   * Wrapper para operaciones que usan secretos
   * 
   * Ejemplo:
   * ```typescript
   * const signature = await secureMemory.withSecretScope(
   *   Buffer.from(p12Base64, 'base64'),
   *   Buffer.from(password),
   *   async (p12, pwd) => {
   *     return await sign(p12, pwd);
   *     // p12 y pwd se limpian automáticamente después
   *   }
   * );
   * ```
   */
  async withSecretScope<T>(
    ...args: [...(Buffer | string)[], ((...buffers: Buffer[]) => Promise<T>)]
  ): Promise<T> {
    const fn = args[args.length - 1] as (...buffers: Buffer[]) => Promise<T>;
    const secrets = args.slice(0, -1) as (Buffer | string)[];

    const secureBuffers = secrets.map(s => {
      if (typeof s === 'string') {
        return Buffer.from(s, 'utf-8');
      }
      return s;
    });

    try {
      return await fn(...secureBuffers);
    } finally {
      // Limpiar todos los buffers después
      this.zeroFillMultiple(...secureBuffers);
    }
  }

  /**
   * Versión sincrónica de withSecretScope
   */
  withSecretScopeSync<T>(
    ...args: [...(Buffer | string)[], ((...buffers: Buffer[]) => T)]
  ): T {
    const fn = args[args.length - 1] as (...buffers: Buffer[]) => T;
    const secrets = args.slice(0, -1) as (Buffer | string)[];

    const secureBuffers = secrets.map(s => {
      if (typeof s === 'string') {
        return Buffer.from(s, 'utf-8');
      }
      return s;
    });

    try {
      return fn(...secureBuffers);
    } finally {
      this.zeroFillMultiple(...secureBuffers);
    }
  }

  /**
   * Hash seguro (no mantiene en memoria)
   */
  secureHash(data: string | Buffer, algorithm = 'sha256'): string {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    try {
      const hash = crypto.createHash(algorithm);
      hash.update(buffer);
      return hash.digest('hex');
    } finally {
      this.zeroFillBuffer(buffer);
    }
  }

  /**
   * Comparar dos buffers de forma time-constant (previene timing attacks)
   */
  secureCompare(a: Buffer | string, b: Buffer | string): boolean {
    const bufA = typeof a === 'string' ? Buffer.from(a, 'utf-8') : a;
    const bufB = typeof b === 'string' ? Buffer.from(b, 'utf-8') : b;

    try {
      return crypto.timingSafeEqual(bufA, bufB);
    } catch (error) {
      // Lengths differ
      return false;
    } finally {
      this.zeroFillBuffer(bufA);
      this.zeroFillBuffer(bufB);
    }
  }

  /**
   * Force garbage collection (solo en desarrollo/testing)
   */
  forceGC(): void {
    if (process.env.NODE_ENV === 'production') {
      log('⚠️ GC forcing disabled in production', 'memory');
      return;
    }

    try {
      if (global.gc) {
        global.gc();
        log('🧹 Garbage collection forced', 'memory');
      } else {
        log('⚠️ GC not exposed. Run with --expose-gc', 'memory');
      }
    } catch (error) {
      log(`⚠️ Error forcing GC: ${(error as Error).message}`, 'memory');
    }
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      memoryUsageKb: Math.round(process.memoryUsage().heapUsed / 1024),
    };
  }

  /**
   * Reset estadísticas (para testing)
   */
  resetStats(): void {
    this.stats = {
      buffersCreated: 0,
      buffersDestroyed: 0,
      bytesSecured: 0,
    };
  }

  /**
   * Monitoreo periódico de memory usage
   */
  startMemoryMonitoring(intervalMs = 60000): NodeJS.Timeout {
    return setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMb = Math.round(usage.heapUsed / 1024 / 1024);
      const heapLimitMb = Math.round(usage.heapTotal / 1024 / 1024);
      
      const usagePercent = Math.round((heapUsedMb / heapLimitMb) * 100);
      
      if (usagePercent > 85) {
        log(
          `⚠️ HEAP WARNING: ${heapUsedMb}MB / ${heapLimitMb}MB (${usagePercent}%)`,
          'memory'
        );
      }

      log(
        `📊 Memory: ${heapUsedMb}MB heap used, RSS: ${Math.round(usage.rss / 1024 / 1024)}MB`,
        'memory'
      );
    }, intervalMs);
  }
}

// Singleton instance
let memoryService: SecureMemoryService | null = null;

/**
 * Obtener instancia del servicio de memoria segura
 */
export function getSecureMemoryService(): SecureMemoryService {
  if (!memoryService) {
    memoryService = new SecureMemoryService();

    // Iniciar monitoreo si está habilitado
    if (process.env.ENABLE_MEMORY_MONITORING === 'true') {
      const monitorTimer = memoryService.startMemoryMonitoring();
      
      process.on('SIGINT', () => clearInterval(monitorTimer));
      process.on('SIGTERM', () => clearInterval(monitorTimer));
    }
  }
  return memoryService;
}

export { SecureBuffer };
export default getSecureMemoryService();
