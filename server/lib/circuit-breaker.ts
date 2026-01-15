/**
 * Circuit Breaker para API del Ministerio de Hacienda
 * 
 * Estados:
 * - CLOSED: Funcionamiento normal, requests pasan a MH
 * - OPEN: MH caído, requests fallan rápido, se encolan en contingencia
 * - HALF_OPEN: Probando recuperación con 1 request, si pasa → CLOSED
 */

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // N fallos consecutivos para abrir
  successThreshold: number; // N éxitos en HALF_OPEN para cerrar
  timeout: number; // ms para esperar antes de HALF_OPEN
  resetTimeout: number; // ms base para backoff exponencial
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private backoffMultiplier = 1;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000, // 1 minuto
      resetTimeout: config.resetTimeout ?? 5000, // 5 segundos base
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN && !this.shouldAttemptReset();
  }

  /**
   * Registrar éxito: resetea contadores, cierra el circuit si estaba en HALF_OPEN
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.backoffMultiplier = 1;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transition(CircuitState.CLOSED);
        this.successCount = 0;
        console.log("✅ Circuit Breaker: HALF_OPEN → CLOSED (MH recuperado)");
      }
    } else if (this.state === CircuitState.CLOSED) {
      console.log("✅ Circuit Breaker: éxito en CLOSED");
    }
  }

  /**
   * Registrar fallo: incrementa contador, abre circuit si llega al threshold
   */
  recordFailure(error?: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      this.transition(CircuitState.OPEN);
      console.warn(
        `⚠️ Circuit Breaker: CLOSED → OPEN (${this.failureCount} fallos consecutivos)`,
        error?.message
      );
      this.backoffMultiplier = 1;
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Fallo durante prueba → volver a OPEN con backoff aumentado
      this.transition(CircuitState.OPEN);
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 8); // Cap en 8x
      console.warn(
        `⚠️ Circuit Breaker: HALF_OPEN → OPEN (fallo en prueba, backoff ${this.backoffMultiplier}x)`,
        error?.message
      );
      this.successCount = 0;
    } else {
      console.log(`⚠️ Circuit Breaker: fallo en ${this.state} (${this.failureCount}/${this.config.failureThreshold})`);
    }
  }

  /**
   * Verificar si puede intentar transición a HALF_OPEN
   */
  private shouldAttemptReset(): boolean {
    if (this.state !== CircuitState.OPEN || !this.lastFailureTime) {
      return false;
    }

    const elapsed = Date.now() - this.lastFailureTime;
    const waitTime = this.config.resetTimeout * this.backoffMultiplier;

    if (elapsed >= waitTime) {
      this.transition(CircuitState.HALF_OPEN);
      console.log(`🔄 Circuit Breaker: OPEN → HALF_OPEN (intentando recuperación)`);
      return true;
    }

    return false;
  }

  /**
   * Ejecutar función con protección de circuit breaker
   * Si está abierto y no debe intentar reset, rechaza inmediatamente
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error(
        `Circuit Breaker OPEN: MH no disponible. Reintentando en ${
          this.config.resetTimeout * this.backoffMultiplier
        }ms`
      );
    }

    // Intentar transición a HALF_OPEN si es momento
    this.shouldAttemptReset();

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }

  /**
   * Reset manual (para testing o recuperación forzada)
   */
  reset(): void {
    this.transition(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.backoffMultiplier = 1;
    console.log("🔧 Circuit Breaker: reset manual");
  }

  /**
   * Obtener información de estado para monitoreo
   */
  getStatus(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    backoffMultiplier: number;
    nextRetryIn?: number;
  } {
    const nextRetryIn =
      this.state === CircuitState.OPEN && this.lastFailureTime
        ? Math.max(0, this.config.resetTimeout * this.backoffMultiplier - (Date.now() - this.lastFailureTime))
        : undefined;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      backoffMultiplier: this.backoffMultiplier,
      nextRetryIn,
    };
  }

  private transition(newState: CircuitState): void {
    this.state = newState;
  }
}

/**
 * Singleton global del Circuit Breaker para MH
 */
let mhBreaker: CircuitBreaker | null = null;

export function getMHCircuitBreaker(): CircuitBreaker {
  if (!mhBreaker) {
    mhBreaker = new CircuitBreaker({
      failureThreshold: 5, // 5 fallos → OPEN
      successThreshold: 2, // 2 éxitos en HALF_OPEN → CLOSED
      timeout: 60000, // 1 minuto esperando antes de HALF_OPEN
      resetTimeout: 5000, // 5 seg base * backoff
    });
  }
  return mhBreaker;
}
