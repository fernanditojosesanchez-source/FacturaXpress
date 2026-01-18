/**
 * Unit Tests - Distributed Lock Service (Redis-backed)
 * 
 * Verifica que el servicio de candados distribuidos funciona correctamente
 * en escenarios de contención, timeout, renovación automática, etc.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getLockService, type LockOptions, type LockResult } from "../../lib/distributed-lock.js";

describe("DistributedLockService", () => {
  const lockService = getLockService();
  const TEST_KEY = "test:lock:unittest";
  const TEST_KEY_2 = "test:lock:unittest:2";

  beforeEach(async () => {
    // Limpiar cualquier lock residual
    try {
      const redis = (lockService as any).redis;
      if (redis) {
        await redis.del(TEST_KEY);
        await redis.del(TEST_KEY_2);
      }
    } catch (e) {
      // Ignorar si Redis no está disponible
      console.warn("Redis not available for cleanup");
    }
  });

  afterEach(async () => {
    // Limpiar después de cada test
    try {
      const redis = (lockService as any).redis;
      if (redis) {
        await redis.del(TEST_KEY);
        await redis.del(TEST_KEY_2);
      }
    } catch (e) {
      // Ignorar
    }
  });

  describe("acquireLock", () => {
    it("debería adquirir un lock cuando no hay contención", async () => {
      const result = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
        maxWaitMs: 1000,
      });

      expect(result.acquired).toBe(true);
      expect(result.lockId).toBeTruthy();
      expect(result.ttlMs).toBe(5000);
    });

    it("debería fallar al adquirir lock si otro lo tiene", async () => {
      // Adquirir primer lock
      const result1 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
        maxWaitMs: 500,
      });

      expect(result1.acquired).toBe(true);

      // Intentar adquirir el mismo lock
      const result2 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
        maxWaitMs: 500,
      });

      expect(result2.acquired).toBe(false);

      // Liberar primer lock
      await lockService.releaseLock(TEST_KEY, result1.lockId);
    });

    it("debería respetar maxWaitMs", async () => {
      // Adquirir primer lock
      const result1 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 10000,
        maxWaitMs: 200,
      });

      expect(result1.acquired).toBe(true);

      // Medir tiempo para segundo intento
      const startTime = Date.now();
      const result2 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
        maxWaitMs: 200,
      });
      const elapsedMs = Date.now() - startTime;

      expect(result2.acquired).toBe(false);
      // Debería esperar aproximadamente maxWaitMs (con margen)
      expect(elapsedMs).toBeGreaterThanOrEqual(150);
      expect(elapsedMs).toBeLessThan(500);

      // Limpiar
      await lockService.releaseLock(TEST_KEY, result1.lockId);
    });
  });

  describe("releaseLock", () => {
    it("debería liberar un lock con ID válido", async () => {
      const result1 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
      });

      expect(result1.acquired).toBe(true);

      const released = await lockService.releaseLock(TEST_KEY, result1.lockId);
      expect(released).toBe(true);

      // Debe poder adquirir el lock nuevamente
      const result2 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
        maxWaitMs: 500,
      });

      expect(result2.acquired).toBe(true);
      await lockService.releaseLock(TEST_KEY, result2.lockId);
    });

    it("debería rechazar release con ID incorrecto", async () => {
      const result1 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
      });

      expect(result1.acquired).toBe(true);

      // Intentar liberar con ID diferente
      const released = await lockService.releaseLock(TEST_KEY, "wrong-id");
      expect(released).toBe(false);

      // El lock debe seguir siendo nuestro
      const result2 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
        maxWaitMs: 500,
      });

      expect(result2.acquired).toBe(false);

      // Limpiar con ID correcto
      await lockService.releaseLock(TEST_KEY, result1.lockId);
    });
  });

  describe("extendLock", () => {
    it("debería extender TTL de un lock válido", async () => {
      const result = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 2000,
      });

      expect(result.acquired).toBe(true);

      // Esperar 1 segundo
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Extender lock
      const extended = await lockService.extendLock(TEST_KEY, result.lockId, 5000);
      expect(extended).toBe(true);

      // Esperar otros 1.5 segundos (total 2.5s, habrían expirado sin extend)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Intentar adquirir - no debería conseguirse porque sigue vigente
      const result2 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
        maxWaitMs: 500,
      });

      expect(result2.acquired).toBe(false);

      // Limpiar
      await lockService.releaseLock(TEST_KEY, result.lockId);
    });

    it("debería fallar extending lock con ID incorrecto", async () => {
      const result = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
      });

      expect(result.acquired).toBe(true);

      // Intentar extender con ID diferente
      const extended = await lockService.extendLock(TEST_KEY, "wrong-id", 5000);
      expect(extended).toBe(false);

      // Limpiar
      await lockService.releaseLock(TEST_KEY, result.lockId);
    });
  });

  describe("Multiple locks", () => {
    it("debería permitir locks simultáneos en keys diferentes", async () => {
      const result1 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
      });
      const result2 = await lockService.acquireLock(TEST_KEY_2, {
        ttlMs: 5000,
      });

      expect(result1.acquired).toBe(true);
      expect(result2.acquired).toBe(true);

      await lockService.releaseLock(TEST_KEY, result1.lockId);
      await lockService.releaseLock(TEST_KEY_2, result2.lockId);
    });

    it("debería mantener locks independientes", async () => {
      const result1 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
      });

      // Otro lock diferente debe funcionar
      const result2 = await lockService.acquireLock(TEST_KEY_2, {
        ttlMs: 5000,
      });

      expect(result1.acquired).toBe(true);
      expect(result2.acquired).toBe(true);

      // Liberar primera no afecta segunda
      await lockService.releaseLock(TEST_KEY, result1.lockId);

      // Primer lock debe poder readquirirse
      const result3 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
        maxWaitMs: 500,
      });

      expect(result3.acquired).toBe(true);

      // Limpiar
      await lockService.releaseLock(TEST_KEY, result3.lockId);
      await lockService.releaseLock(TEST_KEY_2, result2.lockId);
    });
  });

  describe("Timeout behavior", () => {
    it("debería permitir adquirir lock después de timeout", async () => {
      const result1 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 1000, // 1 segundo
        maxWaitMs: 500,
      });

      expect(result1.acquired).toBe(true);

      // No liberar, esperar a que expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Debería poder adquirirse ahora
      const result2 = await lockService.acquireLock(TEST_KEY, {
        ttlMs: 5000,
        maxWaitMs: 500,
      });

      expect(result2.acquired).toBe(true);

      await lockService.releaseLock(TEST_KEY, result2.lockId);
    });
  });
});
