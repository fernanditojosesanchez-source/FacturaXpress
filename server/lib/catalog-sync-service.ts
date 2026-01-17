/**
 * CatalogSyncService
 * 
 * Servicio para sincronizar catálogos de DGII.
 * - Obtiene versiones actuales de DGII
 * - Compara con versiones locales
 * - Actualiza si hay cambios
 * - Mantiene historial y alertas
 * 
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #6
 */

import { db } from "../db.js";
import { 
  catalogVersionsTable, 
  catalogSyncHistoryTable, 
  catalogSyncAlertsTable 
} from "../../shared/schema-catalog-sync.js";
import { and, eq, desc, lte, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import crypto from "crypto";

/**
 * Interface para catálogos DGII
 */
interface DgiiCatalog {
  name: string;
  version: string;
  description: string;
  data: Record<string, any>[];
}

/**
 * Opciones de sincronización
 */
interface SyncOptions {
  force?: boolean; // Forzar sync incluso si no hay cambios
  triggerType?: "auto" | "manual" | "retry";
  triggeredBy?: string; // User ID
}

/**
 * Resultado de sincronización
 */
interface SyncResult {
  catalogName: string;
  success: boolean;
  message: string;
  oldRecordCount?: number;
  newRecordCount?: number;
  changedRecords?: number;
  durationMs: number;
  error?: string;
}

class CatalogSyncService {
  /**
   * Sincroniza un catálogo específico
   */
  async syncCatalog(catalogName: string, options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      // 1. Obtener catálogo remoto de DGII
      const remoteCatalog = await this.fetchDgiiCatalog(catalogName);
      
      // 2. Obtener catálogo local
      const localCatalog = await db
        .select()
        .from(catalogVersionsTable)
        .where(eq(catalogVersionsTable.catalogName, catalogName))
        .limit(1);
      
      const localVersion = localCatalog[0];
      const durationMs = Date.now() - startTime;
      
      // 3. Comparar versiones y hashes
      const localHash = localVersion ? this.hashData(localVersion.data) : null;
      const remoteHash = this.hashData(remoteCatalog.data);
      
      // Si hashes coinciden y no es force sync → skip
      if (!options.force && localHash === remoteHash && localVersion) {
        await this.recordSyncHistory({
          catalogName,
          status: "skipped",
          message: "No changes detected",
          oldRecordCount: localVersion.recordCount,
          newRecordCount: remoteCatalog.data.length,
          changedRecords: 0,
          durationMs,
          triggerType: options.triggerType || "auto",
          triggeredBy: options.triggeredBy,
        });
        
        return {
          catalogName,
          success: true,
          message: "No changes detected - skipped",
          oldRecordCount: localVersion.recordCount,
          newRecordCount: remoteCatalog.data.length,
          changedRecords: 0,
          durationMs,
        };
      }
      
      // 4. Detectar registros que cambiaron
      const changedRecords = this.detectChanges(
        (localVersion?.data as any[]) || [],
        remoteCatalog.data
      );
      
      // 5. Actualizar BD
      if (localVersion) {
        await db
          .update(catalogVersionsTable)
          .set({
            version: remoteCatalog.version,
            recordCount: remoteCatalog.data.length,
            data: remoteCatalog.data,
            dataHash: remoteHash,
            lastSyncAt: new Date(),
            syncStatus: "success",
            syncDurationMs: durationMs,
            error: null,
            updatedAt: new Date(),
          })
          .where(eq(catalogVersionsTable.id, localVersion.id));
      } else {
        // Primer sync del catálogo
        await db.insert(catalogVersionsTable).values({
          catalogName,
          version: remoteCatalog.version,
          description: remoteCatalog.description,
          recordCount: remoteCatalog.data.length,
          data: remoteCatalog.data,
          dataHash: remoteHash,
          lastSyncAt: new Date(),
          syncStatus: "success",
          syncDurationMs: durationMs,
        });
      }
      
      // 6. Registrar en historial
      await this.recordSyncHistory({
        catalogName,
        status: "success",
        message: `Updated from ${localVersion?.recordCount || 0} to ${remoteCatalog.data.length} records`,
        oldRecordCount: localVersion?.recordCount || 0,
        newRecordCount: remoteCatalog.data.length,
        changedRecords,
        durationMs,
        triggerType: options.triggerType || "auto",
        triggeredBy: options.triggeredBy,
      });
      
      // 7. Crear alerta si hay muchos cambios
      if (changedRecords > remoteCatalog.data.length * 0.3) {
        await this.createAlert({
          catalogName,
          severity: "warning",
          title: "Large catalog update detected",
          description: `${changedRecords} records changed (${((changedRecords / remoteCatalog.data.length) * 100).toFixed(1)}%)`,
          recommendation: "Review the catalog changes manually",
        });
      }
      
      return {
        catalogName,
        success: true,
        message: `Successfully synced ${remoteCatalog.data.length} records`,
        oldRecordCount: localVersion?.recordCount || 0,
        newRecordCount: remoteCatalog.data.length,
        changedRecords,
        durationMs,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      
      // Registrar error
      await this.recordSyncHistory({
        catalogName,
        status: "failed",
        message: error.message,
        error: error.message,
        durationMs,
        triggerType: options.triggerType || "auto",
        triggeredBy: options.triggeredBy,
      });
      
      // Crear alerta de error
      await this.createAlert({
        catalogName,
        severity: "error",
        title: `Failed to sync catalog: ${catalogName}`,
        description: error.message,
        recommendation: "Check DGII API status and retry manually",
      });
      
      return {
        catalogName,
        success: false,
        message: `Failed to sync: ${error.message}`,
        durationMs,
        error: error.message,
      };
    }
  }
  
  /**
   * Sincroniza todos los catálogos
   */
  async syncAllCatalogs(options: SyncOptions = {}): Promise<SyncResult[]> {
    const catalogs = [
      "departamentos",
      "tipos_documento",
      "tipos_dte",
      "condiciones_operacion",
      "formas_pago",
      "unidades_medida",
    ];
    
    const results: SyncResult[] = [];
    
    for (const catalogName of catalogs) {
      const result = await this.syncCatalog(catalogName, options);
      results.push(result);
    }
    
    // Verificar si hay muchos fallos
    const failedCount = results.filter(r => !r.success).length;
    if (failedCount > 0) {
      await this.checkFailureCount(failedCount);
    }
    
    return results;
  }
  
  /**
   * Obtiene catálogo de DGII (o mock para testing)
   */
  private async fetchDgiiCatalog(catalogName: string): Promise<DgiiCatalog> {
    // TODO: Implementar integración real con DGII API
    // Por ahora, retorna mock data
    
    const mockCatalogs: Record<string, DgiiCatalog> = {
      departamentos: {
        name: "departamentos",
        version: "1.0.0",
        description: "Departamentos de El Salvador",
        data: [
          { id: "01", nombre: "Ahuachapán" },
          { id: "02", nombre: "Santa Ana" },
          { id: "03", nombre: "Sonsonate" },
          { id: "04", nombre: "Cuscatlán" },
          { id: "05", nombre: "La Libertad" },
          { id: "06", nombre: "San Salvador" },
          { id: "07", nombre: "Cuscatlán" },
          { id: "08", nombre: "La Paz" },
          { id: "09", nombre: "San Vicente" },
          { id: "10", nombre: "Cabañas" },
          { id: "11", nombre: "Chalatenango" },
          { id: "12", nombre: "Santa Ana" },
          { id: "13", nombre: "Usulután" },
          { id: "14", nombre: "San Miguel" },
        ],
      },
      tipos_documento: {
        name: "tipos_documento",
        version: "1.0.0",
        description: "Tipos de documentos de identidad",
        data: [
          { id: "1", descripcion: "DUI" },
          { id: "2", descripcion: "Pasaporte" },
          { id: "3", descripcion: "Carnet de extranjero" },
          { id: "4", descripcion: "Otro" },
        ],
      },
      tipos_dte: {
        name: "tipos_dte",
        version: "1.0.0",
        description: "Tipos de documentos tributarios electrónicos",
        data: [
          { id: "01", descripcion: "Factura" },
          { id: "02", descripcion: "Nota de débito" },
          { id: "03", descripcion: "Nota de crédito" },
          { id: "04", descripcion: "Comprobante de retención" },
        ],
      },
      condiciones_operacion: {
        name: "condiciones_operacion",
        version: "1.0.0",
        description: "Condiciones de operación",
        data: [
          { id: "01", descripcion: "Transferencia de dominio" },
          { id: "02", descripcion: "Arrendamiento financiero" },
          { id: "03", descripcion: "Otra" },
        ],
      },
      formas_pago: {
        name: "formas_pago",
        version: "1.0.0",
        description: "Formas de pago",
        data: [
          { id: "01", descripcion: "Efectivo" },
          { id: "02", descripcion: "Cheque" },
          { id: "03", descripcion: "Transferencia" },
          { id: "04", descripcion: "Depósito" },
          { id: "05", descripcion: "Tarjeta de débito" },
          { id: "06", descripcion: "Tarjeta de crédito" },
          { id: "07", descripcion: "Criptomonedas" },
          { id: "08", descripcion: "Pago mediante instituciones no financieras" },
          { id: "09", descripcion: "Moneda electrónica" },
          { id: "10", descripcion: "Otros" },
        ],
      },
      unidades_medida: {
        name: "unidades_medida",
        version: "1.0.0",
        description: "Unidades de medida",
        data: [
          { id: "1", descripcion: "Unidad" },
          { id: "2", descripcion: "Kilogramo" },
          { id: "3", descripcion: "Gramo" },
          { id: "4", descripcion: "Litro" },
          { id: "5", descripcion: "Metro" },
          { id: "6", descripcion: "Metro cuadrado" },
          { id: "7", descripcion: "Metro cúbico" },
          { id: "8", descripcion: "Hora" },
          { id: "9", descripcion: "Día" },
          { id: "10", descripcion: "Mes" },
        ],
      },
    };
    
    const catalog = mockCatalogs[catalogName];
    if (!catalog) {
      throw new Error(`Unknown catalog: ${catalogName}`);
    }
    
    return catalog;
  }
  
  /**
   * Calcula hash SHA256 de data
   */
  private hashData(data: any): string {
    const json = JSON.stringify(data);
    return crypto.createHash("sha256").update(json).digest("hex");
  }
  
  /**
   * Detecta registros que cambiaron
   */
  private detectChanges(oldData: any[], newData: any[]): number {
    const oldMap = new Map(oldData.map(d => [JSON.stringify(d), d]));
    const newMap = new Map(newData.map(d => [JSON.stringify(d), d]));
    
    let changed = 0;
    
    // Contar registros nuevos o modificados
    for (const [key, newRecord] of newMap) {
      if (!oldMap.has(key)) {
        changed++;
      }
    }
    
    // Contar registros eliminados
    for (const [key] of oldMap) {
      if (!newMap.has(key)) {
        changed++;
      }
    }
    
    return changed;
  }
  
  /**
   * Registra historial de sincronización
   */
  private async recordSyncHistory(data: {
    catalogName: string;
    status: "success" | "failed" | "skipped";
    message: string;
    oldRecordCount?: number;
    newRecordCount?: number;
    changedRecords?: number;
    durationMs: number;
    error?: string;
    triggerType?: "auto" | "manual" | "retry";
    triggeredBy?: string;
  }): Promise<void> {
    await db.insert(catalogSyncHistoryTable).values({
      catalogName: data.catalogName,
      status: data.status,
      message: data.message,
      oldRecordCount: data.oldRecordCount,
      newRecordCount: data.newRecordCount,
      changedRecords: data.changedRecords || 0,
      durationMs: data.durationMs,
      completedAt: new Date(),
      error: data.error,
      triggerType: data.triggerType || "auto",
      triggeredBy: data.triggeredBy,
    });
  }
  
  /**
   * Crea una alerta
   */
  private async createAlert(data: {
    catalogName: string;
    severity: "info" | "warning" | "error" | "critical";
    title: string;
    description: string;
    recommendation?: string;
  }): Promise<void> {
    await db.insert(catalogSyncAlertsTable).values({
      catalogName: data.catalogName,
      severity: data.severity,
      title: data.title,
      description: data.description,
      recommendation: data.recommendation,
    });
  }
  
  /**
   * Verifica si hay demasiados fallos consecutivos
   */
  private async checkFailureCount(failedCount: number): Promise<void> {
    // Si hay 3+ fallos en últimas 24h, crear alerta crítica
    if (failedCount >= 3) {
      const recentFailures = await db
        .select()
        .from(catalogSyncHistoryTable)
        .where(
          and(
            eq(catalogSyncHistoryTable.status, "failed"),
            lte(catalogSyncHistoryTable.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        );
      
      if (recentFailures.length >= 3) {
        await this.createAlert({
          catalogName: "system",
          severity: "critical",
          title: "Multiple catalog sync failures detected",
          description: `${failedCount} catalogs failed to sync in the last sync cycle`,
          recommendation: "Check DGII API status and investigate sync errors immediately",
        });
      }
    }
  }
  
  /**
   * Obtiene historial de sincronizaciones
   */
  async getSyncHistory(catalogName?: string, limit: number = 100) {
    if (catalogName) {
      return db
        .select()
        .from(catalogSyncHistoryTable)
        .where(eq(catalogSyncHistoryTable.catalogName, catalogName))
        .orderBy(desc(catalogSyncHistoryTable.createdAt))
        .limit(limit);
    } else {
      return db
        .select()
        .from(catalogSyncHistoryTable)
        .orderBy(desc(catalogSyncHistoryTable.createdAt))
        .limit(limit);
    }
  }
  
  /**
   * Obtiene versiones actuales
   */
  async getCatalogVersions() {
    return db
      .select()
      .from(catalogVersionsTable)
      .orderBy(catalogVersionsTable.catalogName);
  }
  
  /**
   * Obtiene alertas sin resolver
   */
  async getUnresolvedAlerts() {
    return db
      .select()
      .from(catalogSyncAlertsTable)
      .where(isNull(catalogSyncAlertsTable.resolvedAt))
      .orderBy(desc(catalogSyncAlertsTable.severity), desc(catalogSyncAlertsTable.createdAt));
  }
}

export const catalogSyncService = new CatalogSyncService();
