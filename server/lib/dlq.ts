/**
 * Dead Letter Queue (DLQ) Manager
 * Gestiona jobs que fallaron definitivamente después de todos los reintentos
 */

import { Queue, Job } from "bullmq";
import { storage } from "../storage.js";
import { logAudit } from "./audit.js";
import { sendToSIEM } from "./siem.js";

interface DLQEntry {
  id: string;
  queueName: string;
  jobId: string;
  jobData: any;
  error: string;
  failedAt: Date;
  attempts: number;
  stackTrace?: string;
}

// In-memory DLQ (se puede migrar a BD si se necesita persistencia)
const deadLetterJobs = new Map<string, DLQEntry>();

/**
 * Agrega un job al Dead Letter Queue
 */
export async function addToDLQ(
  job: Job,
  error: Error,
  queueName: string
): Promise<void> {
  const dlqEntry: DLQEntry = {
    id: `dlq-${Date.now()}-${job.id}`,
    queueName,
    jobId: job.id || "unknown",
    jobData: job.data,
    error: error.message,
    failedAt: new Date(),
    attempts: job.attemptsMade,
    stackTrace: error.stack,
  };

  deadLetterJobs.set(dlqEntry.id, dlqEntry);

  console.error(
    `[DLQ] Job ${job.id} movido a DLQ después de ${job.attemptsMade} intentos: ${error.message}`
  );

  // Auditar entrada en DLQ
  await logAudit({
    action: "job_moved_to_dlq",
    tenantId: job.data.tenantId || "system",
    userId: job.data.userId || "system",
    ipAddress: "worker",
    details: {
      queueName,
      jobId: job.id,
      error: error.message,
      attempts: job.attemptsMade,
    },
  });

  // SIEM event
  await sendToSIEM({
    type: "job_dlq",
    level: "error",
    tenantId: job.data.tenantId,
    details: {
      queueName,
      jobId: job.id,
      error: error.message,
      attempts: job.attemptsMade,
    },
  });
}

/**
 * Obtiene todos los jobs en DLQ
 */
export function getDLQJobs(): DLQEntry[] {
  return Array.from(deadLetterJobs.values());
}

/**
 * Obtiene un job específico del DLQ
 */
export function getDLQJob(dlqId: string): DLQEntry | null {
  return deadLetterJobs.get(dlqId) || null;
}

/**
 * Reintenta un job del DLQ
 */
export async function retryDLQJob(
  dlqId: string,
  queue: Queue
): Promise<{ success: boolean; message: string; newJobId?: string }> {
  const dlqEntry = deadLetterJobs.get(dlqId);
  if (!dlqEntry) {
    return { success: false, message: "Job no encontrado en DLQ" };
  }

  try {
    // Re-agregar el job a la cola original
    const job = await queue.add(dlqEntry.queueName, dlqEntry.jobData, {
      attempts: 3, // Menos intentos en retry manual
      priority: 10, // Mayor prioridad
    });

    // Remover del DLQ
    deadLetterJobs.delete(dlqId);

    console.log(`[DLQ] Job ${dlqId} reintentado como ${job.id}`);

    await logAudit({
      action: "job_retried_from_dlq",
      tenantId: dlqEntry.jobData.tenantId || "system",
      userId: "admin",
      ipAddress: "admin",
      details: {
        dlqId,
        newJobId: job.id,
        queueName: dlqEntry.queueName,
      },
    });

    return {
      success: true,
      message: "Job reintentado exitosamente",
      newJobId: job.id,
    };
  } catch (error: any) {
    console.error(`[DLQ] Error reintentando job ${dlqId}:`, error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Elimina un job del DLQ (descarte definitivo)
 */
export async function removeDLQJob(dlqId: string): Promise<boolean> {
  const dlqEntry = deadLetterJobs.get(dlqId);
  if (!dlqEntry) {
    return false;
  }

  deadLetterJobs.delete(dlqId);

  await logAudit({
    action: "job_removed_from_dlq",
    tenantId: dlqEntry.jobData.tenantId || "system",
    userId: "admin",
    ipAddress: "admin",
    details: {
      dlqId,
      queueName: dlqEntry.queueName,
      jobId: dlqEntry.jobId,
    },
  });

  console.log(`[DLQ] Job ${dlqId} eliminado del DLQ`);
  return true;
}

/**
 * Limpia jobs antiguos del DLQ (más de 30 días)
 */
export function cleanupOldDLQJobs(): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let removed = 0;
  for (const [id, entry] of deadLetterJobs.entries()) {
    if (entry.failedAt < thirtyDaysAgo) {
      deadLetterJobs.delete(id);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`[DLQ] Limpieza: ${removed} jobs eliminados (>30 días)`);
  }

  return removed;
}

/**
 * Estadísticas del DLQ
 */
export function getDLQStats(): {
  total: number;
  byQueue: Record<string, number>;
  oldestJob: Date | null;
} {
  const byQueue: Record<string, number> = {};
  let oldestJob: Date | null = null;

  for (const entry of deadLetterJobs.values()) {
    byQueue[entry.queueName] = (byQueue[entry.queueName] || 0) + 1;

    if (!oldestJob || entry.failedAt < oldestJob) {
      oldestJob = entry.failedAt;
    }
  }

  return {
    total: deadLetterJobs.size,
    byQueue,
    oldestJob,
  };
}

/**
 * Scheduler para limpieza automática (ejecutar diariamente)
 */
export function startDLQCleanup(): NodeJS.Timeout {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas

  // Limpieza inmediata al iniciar
  cleanupOldDLQJobs();

  // Programar limpiezas periódicas
  return setInterval(() => {
    cleanupOldDLQJobs();
  }, CLEANUP_INTERVAL);
}
