
import { db } from "../db.js";
import { catalogVersionsTable, type NewCatalogVersion } from "../../shared/schema.js";
import { eq, desc, and } from "drizzle-orm";
import {
  DEPARTAMENTOS_EL_SALVADOR,
  TIPOS_DOCUMENTO,
  TIPOS_DTE,
  CONDICIONES_OPERACION,
  FORMAS_PAGO,
  UNIDADES_MEDIDA
} from "../catalogs.js";

/**
 * Servicio de Sincronización de Catálogos (Auditoría P1)
 * Simula la conexión con la API del MH para descargar catálogos oficiales.
 * En producción, reemplaza los 'mocks' por llamadas reales a https://api.mh.gob.sv/
 */
export class CatalogSyncService {
  private readonly DGII_API_URL = process.env.DGII_CATALOGS_URL || "https://api.mh.gob.sv/catalogos";

  // Mapeo de nombres de catálogos de MH a nuestros exports locales (para bootstrap inicial)
  private readonly CATALOG_MAP: Record<string, any[]> = {
    'CAT-001': DEPARTAMENTOS_EL_SALVADOR,
    'CAT-002': TIPOS_DOCUMENTO,
    'CAT-003': TIPOS_DTE,
    'CAT-004': CONDICIONES_OPERACION,
    'CAT-005': FORMAS_PAGO,
    'CAT-006': UNIDADES_MEDIDA
  };

  /**
   * Ejecuta la sincronización de todos los catálogos configurados.
   */
  async syncCatalogs(): Promise<{ updated: string[], errors: string[] }> {
    const updated: string[] = [];
    const errors: string[] = [];
    const catalogsToCheck = Object.keys(this.CATALOG_MAP);

    console.log(`[CatalogSync] Iniciando sincronización de ${catalogsToCheck.length} catálogos...`);

    for (const catalogDetails of catalogsToCheck) {
      try {
        const result = await this.syncSingleCatalog(catalogDetails);
        if (result.updated) {
          updated.push(catalogDetails);
        }
      } catch (error: any) {
        console.error(`[CatalogSync] Error syncing ${catalogDetails}:`, error);
        errors.push(`${catalogDetails}: ${error.message}`);
      }
    }

    console.log(`[CatalogSync] Completado. Actualizados: ${updated.length}, Errores: ${errors.length}`);
    return { updated, errors };
  }

  /**
   * Sincroniza un catálogo individual.
   * Verifica la versión remota contra la local más reciente.
   */
  private async syncSingleCatalog(catalogName: string): Promise<{ updated: boolean }> {
    // 1. Fetch remoto (Simulado)
    const remoteData = await this.fetchRemoteCatalog(catalogName);
    const remoteVersion = remoteData.version;

    // 2. Check local
    const [latestLocal] = await db
      .select()
      .from(catalogVersionsTable)
      .where(eq(catalogVersionsTable.catalogName, catalogName))
      .orderBy(desc(catalogVersionsTable.lastSyncAt))
      .limit(1);

    // 3. Comparar
    if (latestLocal && latestLocal.version === remoteVersion) {
      // Ya estamos al día
      return { updated: false };
    }

    // 4. Actualizar (Insertar nueva versión)
    console.log(`[CatalogSync] Nueva versión detectada para ${catalogName}: ${remoteVersion}`);

    await db.insert(catalogVersionsTable).values({
      catalogName,
      version: remoteVersion,
      data: remoteData.items, // Guardamos el JSON puro
      syncStatus: 'success',
      recordsCount: remoteData.items.length,
      lastSyncAt: new Date()
    });

    return { updated: true };
  }

  /**
   * MOCK: Simula llamada a API del MH
   * En el futuro, usar fetch(`${this.DGII_API_URL}/${catalogName}`)
   */
  private async fetchRemoteCatalog(catalogName: string): Promise<{ version: string, items: any[] }> {
    // Simular latencia de red
    await new Promise(resolve => setTimeout(resolve, 100));

    // Obtener datos base
    const baseItems = this.CATALOG_MAP[catalogName] || [];

    // Generar un "hash" simple del contenido como versión
    // Si cambiamos los arrays hardcoded en catalogs.ts, esto cambiaría, simulando una actualización
    const contentString = JSON.stringify(baseItems);
    const version = `v-${contentString.length}-${new Date().getFullYear()}`; // Simple versioning mock

    return {
      version,
      items: baseItems
    };
  }

  /**
   * Recupera el catálogo más reciente desde la DB (o fallback a memoria)
   */
  async getCatalog(catalogName: string): Promise<any[]> {
    const [latest] = await db
      .select()
      .from(catalogVersionsTable)
      .where(and(
        eq(catalogVersionsTable.catalogName, catalogName),
        eq(catalogVersionsTable.syncStatus, 'success')
      ))
      .orderBy(desc(catalogVersionsTable.lastSyncAt))
      .limit(1);

    if (latest && latest.data) {
      return latest.data as any[];
    }

    // Fallback a versión hardcoded si falla DB
    return this.CATALOG_MAP[catalogName] || [];
  }
}

export const catalogSyncService = new CatalogSyncService();
