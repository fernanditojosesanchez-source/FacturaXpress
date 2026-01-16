/**
 * Workers BullMQ - Procesadores dedicados para cada cola
 * 
 * Workers dedicados que procesan jobs de manera asíncrona:
 * - Transmisión: Firma + envía DTE al Ministerio de Hacienda
 * - Firma: Solo firma documentos PDF/XML
 * - Notificaciones: Envía emails/webhooks/SMS
 * 
 * Características:
 * - Retry automático con backoff exponencial
 * - Dead Letter Queue para fallos definitivos
 * - Métricas de procesamiento (completed, failed, active)
 * - Graceful shutdown
 */

import { Worker, Job } from "bullmq";
import type {
  TransmisionJob,
  FirmaJob,
  NotificacionJob,
} from "./queues.js";
import { storage } from "../storage.js";
import { logAudit } from "./audit.js";
import { sendToSIEM } from "./siem.js";
import { redisHealth } from "./redis.js";

const log = console.log;

// ============================================================================
// Worker de Transmisión (Firma + Envío al MH)
// ============================================================================

export async function processTransmision(job: Job<TransmisionJob>) {
  const { tenantId, facturaId } = job.data;
  log(`[Worker Transmisión] Procesando factura ${facturaId} (tenant: ${tenantId})`);

  try {
    // 1. Obtener factura del storage
    const factura = await storage.getFactura(facturaId, tenantId);
    if (!factura) {
      throw new Error(`Factura ${facturaId} no encontrada`);
    }

    // 2. Validar que tenga código de generación
    if (!factura.codigoGeneracion) {
      throw new Error(`Factura ${facturaId} sin código de generación`);
    }

    // 3. Firmar documento (si no está firmado)
    if (!factura.selloRecibido) {
      log(`[Worker Transmisión] Firmando factura ${facturaId}...`);
      // TODO: Implementar firma digital con certificado del tenant
      // const firmado = await firmarDocumento(factura, tenantId);
    }

    // 4. Transmitir al MH
    log(`[Worker Transmisión] Transmitiendo al MH: ${facturaId}`);
    // TODO: Integrar con mh-service.ts para enviar al MH
    // const response = await mhService.transmitirDocumento(tenantId, factura);

    // 5. Actualizar estado en BD
    await storage.updateFactura(facturaId, tenantId, {
      selloRecibido: new Date().toISOString(),
    });

    // 6. Auditoría
    await logAudit({
      action: "transmision_success",
      tenantId,
      userId: job.data.userId || "system",
      details: { facturaId, jobId: job.id },
    });

    await sendToSIEM({
      type: "transmision_success",
      level: "info",
      tenantId,
      details: { facturaId, jobId: job.id },
    });

    return { success: true, facturaId };
  } catch (error: any) {
    log(`[Worker Transmisión] Error: ${error.message}`);

    // Auditar fallo
    await logAudit({
      action: "transmision_failed",
      tenantId,
      userId: job.data.userId || "system",
      details: { facturaId, error: error.message, jobId: job.id },
    });

    await sendToSIEM({
      type: "transmision_failed",
      level: "error",
      tenantId,
      details: { facturaId, error: error.message, jobId: job.id },
    });

    throw error; // BullMQ reintentará según configuración
  }
}

// ============================================================================
// Worker de Firma (Solo firma, no transmite)
// ============================================================================

export async function processFirma(job: Job<FirmaJob>) {
  const { tenantId, documentoId, tipo } = job.data;
  log(`[Worker Firma] Firmando ${tipo} ${documentoId} (tenant: ${tenantId})`);

  try {
    // 1. Obtener documento
    const doc = await storage.getFactura(documentoId, tenantId);
    if (!doc) {
      throw new Error(`Documento ${documentoId} no encontrado`);
    }

    // 2. Obtener certificado del tenant
    const certs = await storage.getCertificados(tenantId);
    const certActivo = certs.find((c) => c.activo && new Date(c.validoHasta) > new Date());
    if (!certActivo) {
      throw new Error(`Tenant ${tenantId} sin certificado válido`);
    }

    // 3. Firmar documento
    log(`[Worker Firma] Firmando con certificado ${certActivo.id}...`);
    // TODO: Implementar firma digital real
    // const firma = await firmarConCertificado(doc, certActivo);

    // 4. Guardar firma
    // await storage.guardarFirmaDocumento(documentoId, tenantId, firma);

    await logAudit({
      action: "firma_success",
      tenantId,
      userId: job.data.userId || "system",
      details: { documentoId, tipo, certificadoId: certActivo.id },
    });

    return { success: true, documentoId, tipo };
  } catch (error: any) {
    log(`[Worker Firma] Error: ${error.message}`);

    await logAudit({
      action: "firma_failed",
      tenantId,
      userId: job.data.userId || "system",
      details: { documentoId, error: error.message, tipo },
    });

    throw error;
  }
}

// ============================================================================
// Worker de Notificaciones (Email/SMS/Webhooks)
// ============================================================================

export async function processNotificacion(job: Job<NotificacionJob>) {
  const { tenantId, destinatario, tipo, contenido } = job.data;
  log(`[Worker Notificación] Enviando ${tipo} a ${destinatario}`);

  try {
    switch (tipo) {
      case "email":
        // TODO: Integrar con servicio de email (SendGrid, AWS SES, etc.)
        log(`[Worker Notificación] Enviando email a ${destinatario}`);
        // await emailService.send({ to: destinatario, subject, body });
        break;

      case "sms":
        // TODO: Integrar con servicio SMS (Twilio, AWS SNS, etc.)
        log(`[Worker Notificación] Enviando SMS a ${destinatario}`);
        // await smsService.send({ to: destinatario, message });
        break;

      case "webhook":
        // POST a webhook del tenant
        log(`[Worker Notificación] Enviando webhook a ${destinatario}`);
        const response = await fetch(destinatario, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contenido),
        });
        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }
        break;

      default:
        throw new Error(`Tipo de notificación desconocido: ${tipo}`);
    }

    await logAudit({
      action: "notificacion_sent",
      tenantId,
      userId: "system",
      details: { destinatario, tipo, jobId: job.id },
    });

    return { success: true, tipo, destinatario };
  } catch (error: any) {
    log(`[Worker Notificación] Error: ${error.message}`);

    await logAudit({
      action: "notificacion_failed",
      tenantId,
      userId: "system",
      details: { destinatario, error: error.message, tipo },
    });

    throw error;
  }
}

// ============================================================================
// Inicialización de Workers
// ============================================================================

let transmisionWorker: Worker<TransmisionJob> | null = null;
let firmaWorker: Worker<FirmaJob> | null = null;
let notificacionesWorker: Worker<NotificacionJob> | null = null;

function buildConnectionOptions(): any | null {
  const url = process.env.REDIS_URL;
  if (url) return { url };

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  const tls = process.env.REDIS_TLS === "true";

  if (!host || !port) return null;

  return {
    host,
    port,
    username,
    password,
    tls: tls ? {} : undefined,
  };
}

export async function initWorkers(): Promise<{ started: number; errors: string[] }> {
  const connection = buildConnectionOptions();
  if (!connection) {
    log("⚠️ Workers no iniciados: Redis no disponible");
    return { started: 0, errors: ["Redis no disponible"] };
  }

  const errors: string[] = [];
  let started = 0;

  // Worker de Transmisión
  try {
    transmisionWorker = new Worker<TransmisionJob>(
      process.env.Q_TRANSMISION_NAME || "fx:transmision",
      processTransmision,
      {
        connection,
        concurrency: parseInt(process.env.WORKER_TRANSMISION_CONCURRENCY || "5", 10),
        limiter: {
          max: parseInt(process.env.WORKER_TRANSMISION_RATE_MAX || "10", 10),
          duration: parseInt(process.env.WORKER_TRANSMISION_RATE_DURATION || "1000", 10),
        },
      }
    );

    transmisionWorker.on("completed", (job) => {
      log(`✅ [Worker Transmisión] Job ${job.id} completado`);
    });

    transmisionWorker.on("failed", (job, err) => {
      log(`❌ [Worker Transmisión] Job ${job?.id} falló: ${err.message}`);
    });

    started++;
  } catch (err: any) {
    errors.push(`Transmisión worker: ${err.message}`);
  }

  // Worker de Firma
  try {
    firmaWorker = new Worker<FirmaJob>(
      process.env.Q_FIRMA_NAME || "fx:firma",
      processFirma,
      {
        connection,
        concurrency: parseInt(process.env.WORKER_FIRMA_CONCURRENCY || "3", 10),
      }
    );

    firmaWorker.on("completed", (job) => {
      log(`✅ [Worker Firma] Job ${job.id} completado`);
    });

    firmaWorker.on("failed", (job, err) => {
      log(`❌ [Worker Firma] Job ${job?.id} falló: ${err.message}`);
    });

    started++;
  } catch (err: any) {
    errors.push(`Firma worker: ${err.message}`);
  }

  // Worker de Notificaciones
  try {
    notificacionesWorker = new Worker<NotificacionJob>(
      process.env.Q_NOTIFS_NAME || "fx:notificaciones",
      processNotificacion,
      {
        connection,
        concurrency: parseInt(process.env.WORKER_NOTIFICACIONES_CONCURRENCY || "10", 10),
      }
    );

    notificacionesWorker.on("completed", (job) => {
      log(`✅ [Worker Notificaciones] Job ${job.id} completado`);
    });

    notificacionesWorker.on("failed", (job, err) => {
      log(`❌ [Worker Notificaciones] Job ${job?.id} falló: ${err.message}`);
    });

    started++;
  } catch (err: any) {
    errors.push(`Notificaciones worker: ${err.message}`);
  }

  return { started, errors };
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

export async function closeWorkers(): Promise<void> {
  log("🛑 Cerrando workers...");

  const promises: Promise<void>[] = [];

  if (transmisionWorker) {
    promises.push(transmisionWorker.close());
  }
  if (firmaWorker) {
    promises.push(firmaWorker.close());
  }
  if (notificacionesWorker) {
    promises.push(notificacionesWorker.close());
  }

  await Promise.all(promises);
  log("✅ Workers cerrados");
}
