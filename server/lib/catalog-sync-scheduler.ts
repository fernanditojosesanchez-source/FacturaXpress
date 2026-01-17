/**
 * Catalog Sync Scheduler
 * 
 * Inicia un cron job para sincronizar catálogos DGII cada 24 horas.
 * Ejecuta la sincronización automática a las 2:00 AM.
 * 
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #6
 */

import { catalogSyncService } from "./catalog-sync-service.js";

/**
 * Calcula milisegundos hasta la próxima ejecución a las 2:00 AM
 */
function getDelay(): number {
  const now = new Date();
  const target = new Date(now);
  
  // Establecer la hora a 2:00 AM
  target.setHours(2, 0, 0, 0);
  
  // Si ya pasó las 2:00 AM hoy, programar para mañana
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  return target.getTime() - now.getTime();
}

/**
 * Inicia el scheduler de sincronización de catálogos
 */
export function startCatalogSyncScheduler(): NodeJS.Timeout | null {
  console.log("[CatalogSync] Iniciando scheduler de sincronización de catálogos...");
  
  // Calcular delay inicial
  const initialDelay = getDelay();
  const nextRun = new Date(Date.now() + initialDelay);
  
  console.log(`[CatalogSync] Próxima sincronización: ${nextRun.toLocaleString()}`);
  
  // Ejecutar la sincronización inicial después del delay
  const initialTimer = setTimeout(() => {
    syncCatalogs();
    
    // Ejecutar cada 24 horas después
    const intervalTimer = setInterval(syncCatalogs, 24 * 60 * 60 * 1000);
    
    // Guardar el timer del intervalo para poder detenerlo luego
    (initialTimer as any).__intervalTimer = intervalTimer;
  }, initialDelay);
  
  return initialTimer;
}

/**
 * Ejecuta la sincronización de catálogos
 */
async function syncCatalogs(): Promise<void> {
  try {
    console.log("[CatalogSync] Iniciando sincronización automática de catálogos...");
    const startTime = Date.now();
    
    // Sincronizar todos los catálogos
    const results = await catalogSyncService.syncAllCatalogs({
      triggerType: "auto",
    });
    
    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`[CatalogSync] ✅ Sincronización completada en ${totalTime}ms`);
    console.log(`[CatalogSync] Resultados: ${successCount} exitosas, ${failedCount} fallidas`);
    
    // Log de cada catálogo
    for (const result of results) {
      const status = result.success ? "✅" : "❌";
      console.log(`[CatalogSync] ${status} ${result.catalogName}: ${result.message}`);
    }
  } catch (error) {
    console.error("[CatalogSync] ❌ Error durante sincronización:", error);
  }
}

/**
 * Detiene el scheduler de sincronización
 */
export function stopCatalogSyncScheduler(timer: NodeJS.Timeout): void {
  console.log("[CatalogSync] Deteniendo scheduler de sincronización de catálogos...");
  
  // Detener el timer inicial
  clearTimeout(timer);
  
  // Detener el timer del intervalo si existe
  const intervalTimer = (timer as any).__intervalTimer;
  if (intervalTimer) {
    clearInterval(intervalTimer);
  }
  
  console.log("[CatalogSync] Scheduler detenido");
}
