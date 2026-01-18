import { storage } from "../storage.js";
import { addTransmisionJob, addFirmaJob, addNotificacionJob } from "./queues.js";
import { log } from "../index.js";
import { getLockService, type LockResult } from "./distributed-lock.js";

const BATCH_SIZE = 50;
const OUTBOX_LOCK_KEY = "outbox:processing";
const LOCK_TTL = 30000; // 30 segundos
const MAX_RETRIES = 5;
const INITIAL_BACKOFF = 5000; // 5 segundos

interface OutboxEventTypeMap {
  factura_creada: { facturaId: string; tenantId: string };
  factura_anulada: { facturaId: string; tenantId: string };
  factura_completada: { facturaId: string; tenantId: string };
}

// Deduplicación en memoria para evitar duplicados en la misma ejecución
const processedInBatch = new Set<string>();

/**
 * Calcula el próximo availableAt con backoff exponencial
 */
function calculateNextRetryTime(retries: number): Date {
  const delayMs = INITIAL_BACKOFF * Math.pow(2, Math.min(retries, 4)); // Max 80 segundos
  return new Date(Date.now() + delayMs);
}

/**
 * Intenta publicar un evento en la cola correspondiente
 * Retorna: { success: true } o { success: false, error: string }
 */
async function publishEventToQueue(
  event: {
    id: string;
    eventType: string;
    tenantId: string;
    payload: any;
   aggregateId?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { eventType, tenantId, payload } = event;

    // Mapeo: event type → cola + job type
    switch (eventType) {
      case "factura_creada":
      case "factura_anulada":
      case "factura_completada": {
        // Publicar a cola de transmisión
        const jobData = {
          facturaId: payload.facturaId,
          tenantId: tenantId,
        };
        await addTransmisionJob(jobData);
        return { success: true };
      }

      default:
        return { success: false, error: `Evento desconocido: ${eventType}` };
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Procesa un lote de eventos pendientes del outbox
 */
async function processBatch(): Promise<{ processed: number; failed: number; errors: string[] }> {
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];
  processedInBatch.clear();

  try {
    // Obtener eventos pendientes y listos para procesar
    const events = await storage.getPendingOutbox(BATCH_SIZE);

    if (events.length === 0) {
      return { processed: 0, failed: 0, errors: [] };
    }

    log(`📦 Outbox: procesando ${events.length} evento(s)...`, "outbox");

    for (const event of events) {
      // Skip si ya fue procesado en esta ejecución (deduplicación)
      if (processedInBatch.has(event.id)) {
        continue;
      }

      try {
        // Intentar publicar a la cola
        const result = await publishEventToQueue(event);

        if (result.success) {
          // Marcar como enviado
          await storage.markOutboxSent(event.id);
          processedInBatch.add(event.id);
          processed++;
          log(
            `✅ Outbox[${event.eventType}] id=${event.id} enviado a cola`,
            "outbox"
          );
        } else {
          // Falló: marcar para retry con backoff exponencial
          const nextRetry = calculateNextRetryTime(event.retries || 0);
          const newRetries = (event.retries || 0) + 1;

          if (newRetries >= MAX_RETRIES) {
            // Máximo de intentos alcanzado: mover a DLQ/failed
            await storage.markOutboxFailed(
              event.id,
              `Max retries alcanzados. Último error: ${result.error}`,
              newRetries,
              new Date("2099-01-01") // Nunca reintentar
            );
            failed++;
            errors.push(
              `[${event.id}] Max retries: ${result.error}`
            );
            log(
              `❌ Outbox[${event.eventType}] id=${event.id} alcanzó max retries`,
              "outbox"
            );
          } else {
            // Reschedule con backoff
            await storage.markOutboxFailed(
              event.id,
              result.error || "Unknown error",
              newRetries,
              nextRetry
            );
            failed++;
            const delayMinutes = Math.ceil((nextRetry.getTime() - Date.now()) / 60000);
            log(
              `⚠️ Outbox[${event.eventType}] id=${event.id} reintentará en ${delayMinutes}m (intento ${newRetries}/${MAX_RETRIES}): ${result.error}`,
              "outbox"
            );
          }
        }
      } catch (err) {
        failed++;
        const errMsg = (err as Error).message;
        errors.push(`[${event.id}] ${errMsg}`);
        log(
          `❌ Outbox[${event.eventType}] id=${event.id} error inesperado: ${errMsg}`,
          "outbox"
        );
      }
    }
  } catch (err) {
    const errMsg = (err as Error).message;
    log(`❌ Error procesando batch de outbox: ${errMsg}`, "outbox");
    errors.push(errMsg);
  }

  return { processed, failed, errors };
}

/**
 * Inicia el procesador de outbox con Distributed Lock (Redis-backed)
 * 
 * Cambios respecto a versión anterior:
 * - ✅ Usa distributed lock para prevenir duplicación en multi-instancia
 * - ✅ Variable `isProcessing` REMOVIDA (ya no es suficiente en Kubernetes)
 * - ✅ Redis lock con auto-renewal durante el procesamiento
 * - ✅ Graceful handling de lock timeouts
 * 
 * @see AUDITORIA_CRITICA_2026.md - Hallazgo #2 (P0: Race Conditions)
 */
let processorTimer: NodeJS.Timeout | null = null;

export async function startOutboxProcessor(intervalMs: number = 5000): Promise<void> {
  if (processorTimer) {
    log("⚠️ Outbox processor ya está corriendo", "outbox");
    return;
  }

  log(`🚀 Iniciando outbox processor (intervalo: ${intervalMs}ms) con Distributed Lock`, "outbox");

  const processLoop = async () => {
    const lockService = getLockService();
    let lockResult: LockResult | null = null;

    try {
      // Intentar adquirir lock distribuido
      lockResult = await lockService.acquireLock(OUTBOX_LOCK_KEY, {
        ttlMs: LOCK_TTL,
        maxWaitMs: 2000, // No esperar demasiado si otra instancia está procesando
        autoRenew: true,  // Auto-renovar mientras se procesa
      });

      if (!lockResult.acquired) {
        // Otra instancia está procesando el lote, skip silenciosamente
        // log(`⏭️ Skip: otra instancia está procesando outbox`, "outbox");
        return;
      }

      // ✅ Tenemos el lock, procesar batch
      const result = await processBatch();
      
      if (result.processed > 0 || result.failed > 0) {
        log(
          `📊 Outbox: ${result.processed} enviados, ${result.failed} con retry${
            result.errors.length > 0 ? `, errores: ${result.errors.slice(0, 3).join("; ")}` : ""
          }`,
          "outbox"
        );
      }
    } catch (err) {
      log(`❌ Error en outbox processor loop: ${(err as Error).message}`, "outbox");
    } finally {
      // Liberar lock si lo tenemos
      if (lockResult?.acquired && lockResult?.lockId) {
        const lockService = getLockService();
        await lockService.releaseLock(OUTBOX_LOCK_KEY, lockResult.lockId);
      }
    }
  };

  // Ejecutar inmediatamente y luego cada intervalMs
  await processLoop();
  processorTimer = setInterval(processLoop, intervalMs);
}

/**
 * Detiene el procesador de outbox
 */
export async function stopOutboxProcessor(): Promise<void> {
  if (processorTimer) {
    clearInterval(processorTimer);
    processorTimer = null;
    log("🛑 Outbox processor detenido", "outbox");
  }
}

/**
 * Obtiene estadísticas actuales del outbox
 */
export async function getOutboxStats(): Promise<{
  pending: number;
  failed: number;
  avgLagMs: number;
}> {
  try {
    const pending = await storage.getPendingOutbox(999999);
    const now = Date.now();

    let totalLag = 0;
    pending.forEach((event) => {
      const lag = now - event.createdAt.getTime();
      totalLag += lag;
    });

    return {
      pending: pending.length,
      failed: 0, // Se podría agregar un método para contar fallidos si es necesario
      avgLagMs: pending.length > 0 ? Math.round(totalLag / pending.length) : 0,
    };
  } catch (err) {
    log(`⚠️ Error obteniendo estadísticas outbox: ${(err as Error).message}`, "outbox");
    return { pending: 0, failed: 0, avgLagMs: 0 };
  }
}

/**
 * Replay manual: procesar todos los eventos hasta (incluyendo) una fecha
 * Útil para recuperación de fallos o re-procesar eventos antiguos
 */
export async function replayOutboxUntil(untilDate: Date): Promise<void> {
  log(`🔄 Replay outbox hasta ${untilDate.toISOString()}`, "outbox");

  let totalProcessed = 0;
  let totalFailed = 0;

  while (true) {
    const events = await storage.getPendingOutbox(BATCH_SIZE);
    if (events.length === 0) break;

    // Filtrar solo eventos creados antes de la fecha
    const toReplay = events.filter((e) => e.createdAt <= untilDate);
    if (toReplay.length === 0) break;

    for (const event of toReplay) {
      try {
        const result = await publishEventToQueue(event);
        if (result.success) {
          await storage.markOutboxSent(event.id);
          totalProcessed++;
        } else {
          totalFailed++;
        }
      } catch (err) {
        totalFailed++;
      }
    }
  }

  log(`✅ Replay completado: ${totalProcessed} enviados, ${totalFailed} fallidos`, "outbox");
}
