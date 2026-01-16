/**
 * Métricas de BullMQ para Prometheus
 * 
 * Exporta métricas de colas y workers en formato Prometheus:
 * - Trabajos completados, fallidos, activos
 * - Tiempos de procesamiento
 * - Tamaño de colas
 * - Estado de workers
 * 
 * Endpoint: GET /metrics
 */

import type { Queue } from "bullmq";

export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export async function getQueueMetrics(queue: Queue): Promise<QueueMetrics> {
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed"
  );

  const isPaused = await queue.isPaused();

  return {
    name: queue.name,
    waiting: counts.waiting || 0,
    active: counts.active || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    delayed: counts.delayed || 0,
    paused: isPaused,
  };
}

/**
 * Exporta métricas en formato Prometheus
 */
export function formatPrometheusMetrics(metrics: QueueMetrics[]): string {
  const lines: string[] = [];

  // Metadata
  lines.push("# HELP bullmq_queue_waiting Jobs esperando procesamiento");
  lines.push("# TYPE bullmq_queue_waiting gauge");
  metrics.forEach((m) => {
    lines.push(`bullmq_queue_waiting{queue="${m.name}"} ${m.waiting}`);
  });

  lines.push("# HELP bullmq_queue_active Jobs actualmente procesándose");
  lines.push("# TYPE bullmq_queue_active gauge");
  metrics.forEach((m) => {
    lines.push(`bullmq_queue_active{queue="${m.name}"} ${m.active}`);
  });

  lines.push("# HELP bullmq_queue_completed Total de jobs completados");
  lines.push("# TYPE bullmq_queue_completed counter");
  metrics.forEach((m) => {
    lines.push(`bullmq_queue_completed{queue="${m.name}"} ${m.completed}`);
  });

  lines.push("# HELP bullmq_queue_failed Total de jobs fallidos");
  lines.push("# TYPE bullmq_queue_failed counter");
  metrics.forEach((m) => {
    lines.push(`bullmq_queue_failed{queue="${m.name}"} ${m.failed}`);
  });

  lines.push("# HELP bullmq_queue_delayed Jobs programados para el futuro");
  lines.push("# TYPE bullmq_queue_delayed gauge");
  metrics.forEach((m) => {
    lines.push(`bullmq_queue_delayed{queue="${m.name}"} ${m.delayed}`);
  });

  lines.push("# HELP bullmq_queue_paused Cola pausada (1) o activa (0)");
  lines.push("# TYPE bullmq_queue_paused gauge");
  metrics.forEach((m) => {
    lines.push(`bullmq_queue_paused{queue="${m.name}"} ${m.paused ? 1 : 0}`);
  });

  return lines.join("\n") + "\n";
}

/**
 * Obtiene resumen de todas las colas para healthcheck
 */
export function getQueuesSummary(metrics: QueueMetrics[]): {
  healthy: boolean;
  total: number;
  active: number;
  failed: number;
  queues: { name: string; status: string }[];
} {
  const totalActive = metrics.reduce((sum, m) => sum + m.active, 0);
  const totalFailed = metrics.reduce((sum, m) => sum + m.failed, 0);

  const queues = metrics.map((m) => {
    let status = "ok";
    if (m.paused) status = "paused";
    else if (m.failed > 100) status = "degraded";
    else if (m.waiting > 1000) status = "congested";

    return { name: m.name, status };
  });

  const healthy = queues.every((q) => q.status === "ok");

  return {
    healthy,
    total: metrics.length,
    active: totalActive,
    failed: totalFailed,
    queues,
  };
}

/**
 * Agrega métricas de outbox a formato Prometheus
 */
export function formatOutboxMetrics(outboxStats: {
  pending: number;
  failed: number;
  avgLagMs: number;
}): string {
  const lines: string[] = [];

  lines.push("# HELP outbox_pending_events Eventos pendientes en el outbox");
  lines.push("# TYPE outbox_pending_events gauge");
  lines.push(`outbox_pending_events ${outboxStats.pending}`);

  lines.push("# HELP outbox_failed_events Eventos fallidos (después de max retries)");
  lines.push("# TYPE outbox_failed_events gauge");
  lines.push(`outbox_failed_events ${outboxStats.failed}`);

  lines.push("# HELP outbox_avg_lag_ms Lag promedio de eventos en el outbox (ms)");
  lines.push("# TYPE outbox_avg_lag_ms gauge");
  lines.push(`outbox_avg_lag_ms ${outboxStats.avgLagMs}`);

  return lines.join("\n") + "\n";
}
