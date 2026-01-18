/**
 * Integration Tests - Multi-instance Outbox Processing (P0.1)
 * 
 * Verifica que el Outbox nunca duplica DTEs cuando múltiples instancias
 * intentan procesarlo simultáneamente usando el candado distribuido.
 * 
 * Escenarios:
 * 1. Dos instancias intentan procesar al mismo tiempo → solo una gana
 * 2. Una instancia procesa, la otra espera y retoma después → sin duplicación
 * 3. Instancia se cae mientras procesa → otra instancia retoma después del timeout
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLockService } from "../../lib/distributed-lock.js";
import { log } from "../../index.js";

/**
 * Simulación de instancia Node.js procesando Outbox
 */
class OutboxProcessorInstance {
  private instanceId: string;
  private processedCount = 0;
  private lockService = getLockService();

  constructor(id: string) {
    this.instanceId = id;
  }

  async processOutboxBatch(delayMs = 0): Promise<{
    success: boolean;
    instanceId: string;
    itemsProcessed: number;
  }> {
    const OUTBOX_LOCK_KEY = "test:outbox:processing";

    // Intentar adquirir lock
    const lockResult = await this.lockService.acquireLock(OUTBOX_LOCK_KEY, {
      ttlMs: 5000,
      maxWaitMs: 2000,
      autoRenew: true,
    });

    if (!lockResult.acquired) {
      return {
        success: false,
        instanceId: this.instanceId,
        itemsProcessed: 0,
      };
    }

    try {
      // Simular procesamiento de Outbox
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // En producción, aquí iría:
      // - Leer eventos de tabla outbox
      // - Publicar a colas
      // - Marcar como processed

      this.processedCount += 50; // Simulamos procesar 50 items

      return {
        success: true,
        instanceId: this.instanceId,
        itemsProcessed: 50,
      };
    } finally {
      await this.lockService.releaseLock(OUTBOX_LOCK_KEY, lockResult.lockId);
    }
  }

  getProcessedCount(): number {
    return this.processedCount;
  }
}

describe("Multi-instance Outbox Processing", () => {
  const OUTBOX_LOCK_KEY = "test:outbox:processing";
  const lockService = getLockService();

  beforeEach(async () => {
    // Limpiar lock antes de cada test
    try {
      const redis = (lockService as any).redis;
      if (redis) {
        await redis.del(OUTBOX_LOCK_KEY);
      }
    } catch (e) {
      console.warn("Redis cleanup failed");
    }
  });

  afterEach(async () => {
    // Limpiar después de test
    try {
      const redis = (lockService as any).redis;
      if (redis) {
        await redis.del(OUTBOX_LOCK_KEY);
      }
    } catch (e) {
      console.warn("Redis cleanup failed");
    }
  });

  describe("Contención de locks", () => {
    it("debería permitir que solo una instancia procese Outbox", async () => {
      const instance1 = new OutboxProcessorInstance("node-1");
      const instance2 = new OutboxProcessorInstance("node-2");

      // Ambas intentan procesar simultáneamente
      const [result1, result2] = await Promise.all([
        instance1.processOutboxBatch(100), // Simula procesamiento de 100ms
        instance2.processOutboxBatch(100),
      ]);

      // Solo una debería tener éxito
      const successCount = [result1, result2].filter((r) => r.success).length;
      expect(successCount).toBe(1);

      // La ganadora debería haber procesado items
      if (result1.success) {
        expect(result1.itemsProcessed).toBe(50);
        expect(result2.success).toBe(false);
        expect(result2.itemsProcessed).toBe(0);
      } else {
        expect(result2.itemsProcessed).toBe(50);
        expect(result1.success).toBe(false);
        expect(result1.itemsProcessed).toBe(0);
      }
    });

    it("debería permitir secuencia serial: instance1 → instance2", async () => {
      const instance1 = new OutboxProcessorInstance("node-1");
      const instance2 = new OutboxProcessorInstance("node-2");

      // Instance 1 procesa primero
      const result1 = await instance1.processOutboxBatch(50);
      expect(result1.success).toBe(true);
      expect(result1.itemsProcessed).toBe(50);

      // Instance 2 procesa después (debería conseguir el lock)
      const result2 = await instance2.processOutboxBatch(50);
      expect(result2.success).toBe(true);
      expect(result2.itemsProcessed).toBe(50);

      // Total procesado debe ser suma correcta, sin duplicación
      expect(instance1.getProcessedCount() + instance2.getProcessedCount()).toBe(100);
    });

    it("debería prevenir race condition de duplicación de DTEs", async () => {
      // Escenario: si el lock fallara, ambas instancias procesarían el mismo evento
      // Esto causaría duplicación de DTEs transmitidos al MH

      const instance1 = new OutboxProcessorInstance("node-1");
      const instance2 = new OutboxProcessorInstance("node-2");

      // Simular intento concurrente 10 veces
      let duplicateDetected = false;

      for (let i = 0; i < 10; i++) {
        const [result1, result2] = await Promise.all([
          instance1.processOutboxBatch(30),
          instance2.processOutboxBatch(30),
        ]);

        // Verificar que no ambas ganaron el lock en la misma ronda
        if (result1.success && result2.success) {
          duplicateDetected = true;
          break;
        }
      }

      expect(duplicateDetected).toBe(false);
    });
  });

  describe("Timeout y recuperación", () => {
    it("debería permitir que otra instancia retome si propietario se cae", async () => {
      const lockResult = await lockService.acquireLock(OUTBOX_LOCK_KEY, {
        ttlMs: 1000, // 1 segundo TTL
        maxWaitMs: 500,
      });

      expect(lockResult.acquired).toBe(true);

      // Simular instancia cae sin liberar lock
      // NO llamar a releaseLock()

      // Esperar a que expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Otra instancia debería poder adquirir ahora
      const instance = new OutboxProcessorInstance("node-2");
      const result = await instance.processOutboxBatch(50);

      expect(result.success).toBe(true);
      expect(result.itemsProcessed).toBe(50);
    });

    it("debería respetar autoRenew para operaciones largas", async () => {
      const lockResult1 = await lockService.acquireLock(OUTBOX_LOCK_KEY, {
        ttlMs: 2000, // 2 segundos
        autoRenew: true,
        maxWaitMs: 500,
      });

      expect(lockResult1.acquired).toBe(true);

      // Simular operación larga (3 segundos)
      // Con autoRenew, el lock se extiende cada ~1.6s automáticamente
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Otra instancia no debería poder adquirir
      const lockResult2 = await lockService.acquireLock(OUTBOX_LOCK_KEY, {
        ttlMs: 2000,
        autoRenew: false,
        maxWaitMs: 500,
      });

      // No debería conseguir el lock porque está renovado
      expect(lockResult2.acquired).toBe(false);

      // Limpiar
      await lockService.releaseLock(OUTBOX_LOCK_KEY, lockResult1.lockId);
    });
  });

  describe("Load behavior", () => {
    it("debería manejar múltiples intentos concurrentes", async () => {
      const instances = Array.from({ length: 5 }, (_, i) =>
        new OutboxProcessorInstance(`node-${i}`)
      );

      // Todos intentan procesar simultáneamente
      const results = await Promise.all(
        instances.map((inst) => inst.processOutboxBatch(50))
      );

      // Solo 1 debería tener éxito
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(1);

      // El rest debería fallar
      const failCount = results.filter((r) => !r.success).length;
      expect(failCount).toBe(4);
    });

    it("debería mantener correctitud bajo alta contención", async () => {
      const instances = Array.from({ length: 20 }, (_, i) =>
        new OutboxProcessorInstance(`node-${i}`)
      );

      let totalProcessed = 0;

      // 20 rounds de procesamiento
      for (let round = 0; round < 20; round++) {
        const results = await Promise.all(
          instances.map((inst) => inst.processOutboxBatch(10))
        );

        const successCount = results.filter((r) => r.success).length;
        expect(successCount).toBe(1); // Solo 1 ganador por ronda

        totalProcessed += 50; // 50 items procesados por ronda
      }

      expect(totalProcessed).toBe(20 * 50); // 20 rondas × 50 items
    });
  });

  describe("Edge cases", () => {
    it("debería manejar liberación múltiple del mismo lock", async () => {
      const lockResult = await lockService.acquireLock(OUTBOX_LOCK_KEY, {
        ttlMs: 5000,
      });

      expect(lockResult.acquired).toBe(true);

      // Primera liberación - debería funcionar
      const release1 = await lockService.releaseLock(
        OUTBOX_LOCK_KEY,
        lockResult.lockId
      );
      expect(release1).toBe(true);

      // Segunda liberación - debería fallar (ya no hay lock)
      const release2 = await lockService.releaseLock(
        OUTBOX_LOCK_KEY,
        lockResult.lockId
      );
      expect(release2).toBe(false);
    });

    it("debería rechazar operaciones con lockId inválido", async () => {
      const lockResult = await lockService.acquireLock(OUTBOX_LOCK_KEY, {
        ttlMs: 5000,
      });

      expect(lockResult.acquired).toBe(true);

      // Intentar liberar con lockId falso
      const released = await lockService.releaseLock(
        OUTBOX_LOCK_KEY,
        "invalid-lock-id"
      );
      expect(released).toBe(false);

      // El lock original sigue siendo válido
      const instance = new OutboxProcessorInstance("node-test");
      const result = await instance.processOutboxBatch(10);
      expect(result.success).toBe(false); // No puede adquirir porque ya está tomado

      // Limpiar con ID correcto
      await lockService.releaseLock(OUTBOX_LOCK_KEY, lockResult.lockId);
    });
  });
});
