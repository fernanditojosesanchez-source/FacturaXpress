import { Queue, QueueEvents, JobsOptions } from "bullmq";
import { redisHealth } from "./redis.js";
import { storage } from "../storage.js";

function getEnvBool(name: string, def = false): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function buildConnectionOptions(): any | null {
  const url = process.env.REDIS_URL;
  if (url) return { url };

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  const tls = getEnvBool("REDIS_TLS", false);

  if (!host || !port) return null;

  return {
    host,
    port,
    username,
    password,
    tls: tls ? {} : undefined,
  } as any;
}

export type TransmisionJob = { facturaId: string; tenantId: string; userId?: string };
export type FirmaJob = { facturaId: string; tenantId: string; documentoId: string; tipo: string; userId?: string };
export type NotificacionJob = { tenantId: string; channel: string; payload: any; destinatario: string; tipo: string; contenido?: any };

export let transmisionQueue: Queue<TransmisionJob> | null = null;
export let firmaQueue: Queue<FirmaJob> | null = null;
export let notificacionesQueue: Queue<NotificacionJob> | null = null;

// Dead Letter Queue Configuration
const DLQ_CONFIG = {
  attempts: parseInt(process.env.BULLMQ_MAX_ATTEMPTS || "5", 10),
  backoff: {
    type: "exponential" as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 7 * 24 * 3600,
    count: 1000,
  },
  removeOnFail: {
    age: 30 * 24 * 3600,
    count: 5000,
  },
};

export async function initQueues(): Promise<{ enabled: boolean; reason?: string }> {
  try {
    const health = await redisHealth();
    if (!health.ok) {
      return { enabled: false, reason: `Redis no disponible: ${health.message}` };
    }

    const connection = buildConnectionOptions();
    if (!connection) {
      return { enabled: false, reason: "Config Redis incompleta" };
    }

    transmisionQueue = new Queue<TransmisionJob>(
      process.env.Q_TRANSMISION_NAME || "fx-transmision",
      {
        connection,
        defaultJobOptions: {
          ...DLQ_CONFIG,
          priority: 1,
        },
      }
    );

    firmaQueue = new Queue<FirmaJob>(
      process.env.Q_FIRMA_NAME || "fx-firma",
      {
        connection,
        defaultJobOptions: {
          ...DLQ_CONFIG,
          priority: 2,
        },
      }
    );

    notificacionesQueue = new Queue<NotificacionJob>(
      process.env.Q_NOTIFS_NAME || "fx-notificaciones",
      {
        connection,
        defaultJobOptions: {
          ...DLQ_CONFIG,
          priority: 3,
          attempts: 8,
        },
      }
    );

    // Opcional: eventos
    new QueueEvents(process.env.Q_TRANSMISION_NAME || "fx-transmision", { connection });
    new QueueEvents(process.env.Q_FIRMA_NAME || "fx-firma", { connection });
    new QueueEvents(process.env.Q_NOTIFS_NAME || "fx-notificaciones", { connection });

    console.log("✅ BullMQ colas inicializadas con DLQ");
    return { enabled: true };
  } catch (err) {
    console.error("[Queues] Error inicializando BullMQ:", (err as Error).message);
    return { enabled: false, reason: (err as Error).message };
  }
}

export async function addTransmisionJob(job: TransmisionJob, opts?: JobsOptions) {
  if (transmisionQueue) {
    return await transmisionQueue.add("transmitir", job, opts);
  }
  // Fallback: si no hay Redis, usar cola de contingencia en BD
  const factura = await storage.getFactura(job.facturaId, job.tenantId);
  if (factura?.codigoGeneracion) {
    await storage.addToContingenciaQueue(job.tenantId, job.facturaId, factura.codigoGeneracion);
  }
  return { id: `local-${Date.now()}`, name: "transmitir", data: job } as any;
}

export async function addFirmaJob(job: FirmaJob, opts?: JobsOptions) {
  if (firmaQueue) {
    return await firmaQueue.add("firmar", job, opts);
  }
  // Sin Redis: no-op
  return { id: `local-${Date.now()}`, name: "firmar", data: job } as any;
}

export async function addNotificacionJob(job: NotificacionJob, opts?: JobsOptions) {
  if (notificacionesQueue) {
    return await notificacionesQueue.add("notificar", job, opts);
  }
  // Fallback: loguear
  console.log("[Notificaciones][local]", job.channel, job.payload);
  return { id: `local-${Date.now()}`, name: "notificar", data: job } as any;
}

export function getQueues() {
  return {
    transmisionQueue,
    firmaQueue,
    notificacionesQueue,
  };
}

export async function cleanOldJobs(): Promise<{ cleaned: number }> {
  let cleaned = 0;

  if (transmisionQueue) {
    await transmisionQueue.clean(7 * 24 * 3600 * 1000, 1000, "completed");
    await transmisionQueue.clean(30 * 24 * 3600 * 1000, 5000, "failed");
    cleaned++;
  }

  if (firmaQueue) {
    await firmaQueue.clean(7 * 24 * 3600 * 1000, 1000, "completed");
    await firmaQueue.clean(30 * 24 * 3600 * 1000, 5000, "failed");
    cleaned++;
  }

  if (notificacionesQueue) {
    await notificacionesQueue.clean(7 * 24 * 3600 * 1000, 1000, "completed");
    await notificacionesQueue.clean(30 * 24 * 3600 * 1000, 5000, "failed");
    cleaned++;
  }

  return { cleaned };
}

export async function getQueuesStats() {
  const stats: any[] = [];

  if (transmisionQueue) {
    const counts = await transmisionQueue.getJobCounts();
    stats.push({
      name: "transmision",
      ...counts,
    });
  }

  if (firmaQueue) {
    const counts = await firmaQueue.getJobCounts();
    stats.push({
      name: "firma",
      ...counts,
    });
  }

  if (notificacionesQueue) {
    const counts = await notificacionesQueue.getJobCounts();
    stats.push({
      name: "notificaciones",
      ...counts,
    });
  }

  return stats;
}
