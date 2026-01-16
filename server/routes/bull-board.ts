/**
 * Bull Board - Dashboard visual para monitorear colas BullMQ
 * 
 * Panel web interactivo que permite:
 * - Ver estado de todas las colas en tiempo real
 * - Inspeccionar jobs individuales (completed, failed, waiting)
 * - Reintentar jobs fallidos manualmente
 * - Ver logs y stack traces de errores
 * - Pausar/reanudar colas
 * 
 * URL: /admin/queues
 * Requiere autenticación de admin
 */

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { Express } from "express";
import { getQueues } from "../lib/queues.js";

const log = console.log;

export function setupBullBoard(app: Express): void {
  const { transmisionQueue, firmaQueue, notificacionesQueue } = getQueues();

  // Si no hay colas disponibles, no montar dashboard
  if (!transmisionQueue && !firmaQueue && !notificacionesQueue) {
    log("⚠️ Bull Board deshabilitado: No hay colas BullMQ activas");
    return;
  }

  // Crear adaptador para Express
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  // Registrar colas disponibles
  const queues: BullMQAdapter[] = [];
  if (transmisionQueue) queues.push(new BullMQAdapter(transmisionQueue));
  if (firmaQueue) queues.push(new BullMQAdapter(firmaQueue));
  if (notificacionesQueue) queues.push(new BullMQAdapter(notificacionesQueue));

  createBullBoard({
    queues,
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: "FacturaXpress - Colas BullMQ",
        boardLogo: {
          path: "/logo.png",
          width: 120,
          height: 40,
        },
        miscLinks: [
          { text: "Volver a Admin", url: "/admin" },
          { text: "Documentación", url: "/docs/queues" },
        ],
        favIcon: {
          default: "static/favicon.ico",
          alternative: "static/favicon-32x32.png",
        },
      },
    },
  });

  // Montar rutas del dashboard
  app.use("/admin/queues", serverAdapter.getRouter());

  log("✅ Bull Board disponible en /admin/queues");
}
