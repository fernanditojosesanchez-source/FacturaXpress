
import { catalogSyncService } from "./catalog-sync-service.js";
import { log } from "../index.js";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Inicia el cron job para sincronizar catálogos.
 * Ejecuta una sincronización inmediata al inicio y luego cada 24h.
 */
export function startCatalogSyncScheduler(): NodeJS.Timeout {
  // Ejecutar inmediatamente al inicio (async sin bloquear)
  catalogSyncService.syncCatalogs()
    .then(result => {
      if (result.updated.length > 0) {
        log(`[Scheduler] Catálogos sincronizados al inicio: ${result.updated.join(', ')}`);
      }
    })
    .catch(err => {
      console.error("[Scheduler] Error en sync inicial de catálogos:", err);
    });

  // Programar intervalo
  const timer = setInterval(async () => {
    try {
      const result = await catalogSyncService.syncCatalogs();
      if (result.updated.length > 0) {
        log(`[Scheduler] Catálogos actualizados: ${result.updated.join(', ')}`);
      } else {
        // Silencioso si no hay cambios para no llenar logs
      }
    } catch (error) {
      console.error("[Scheduler] Error en sync programado:", error);
    }
  }, SYNC_INTERVAL_MS);

  return timer;
}

export function stopCatalogSyncScheduler(timer: NodeJS.Timeout | null) {
  if (timer) {
    clearInterval(timer);
    log("✅ Scheduler de catálogos detenido");
  }
}
