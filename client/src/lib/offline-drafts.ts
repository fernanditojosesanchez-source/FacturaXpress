/**
 * Offline Drafts - Sistema de borradores offline con IndexedDB
 * Permite trabajar sin conexión y sincronizar al reconectar
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";

interface FacturaDraft {
  id: string;
  tenantId: string;
  userId: string;
  data: any;
  createdAt: number;
  updatedAt: number;
  syncStatus: "pending" | "syncing" | "synced" | "error";
  syncError?: string;
  serverFacturaId?: string;
}

interface OfflineDB extends DBSchema {
  drafts: {
    key: string;
    value: FacturaDraft;
    indexes: {
      "by-tenant": string;
      "by-status": string;
      "by-updated": number;
    };
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      action: "create" | "update" | "delete";
      resource: string;
      data: any;
      timestamp: number;
      retries: number;
    };
  };
}

let db: IDBPDatabase<OfflineDB> | null = null;

/**
 * Inicializa IndexedDB
 */
export async function initOfflineDB(): Promise<void> {
  if (db) return;

  db = await openDB<OfflineDB>("facturaxpress-offline", 1, {
    upgrade(db) {
      // Store de borradores
      const draftsStore = db.createObjectStore("drafts", { keyPath: "id" });
      draftsStore.createIndex("by-tenant", "tenantId");
      draftsStore.createIndex("by-status", "syncStatus");
      draftsStore.createIndex("by-updated", "updatedAt");

      // Store de cola de sincronización
      const syncStore = db.createObjectStore("syncQueue", { keyPath: "id" });
    },
  });

  console.log("[Offline] IndexedDB inicializada");
}

/**
 * Guarda un borrador en IndexedDB
 */
export async function saveDraft(
  tenantId: string,
  userId: string,
  data: any
): Promise<string> {
  if (!db) await initOfflineDB();

  const draft: FacturaDraft = {
    id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tenantId,
    userId,
    data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: "pending",
  };

  await db!.put("drafts", draft);
  console.log(`[Offline] Borrador guardado: ${draft.id}`);

  return draft.id;
}

/**
 * Actualiza un borrador existente
 */
export async function updateDraft(
  draftId: string,
  data: Partial<any>
): Promise<void> {
  if (!db) await initOfflineDB();

  const existing = await db!.get("drafts", draftId);
  if (!existing) {
    throw new Error(`Borrador ${draftId} no encontrado`);
  }

  existing.data = { ...existing.data, ...data };
  existing.updatedAt = Date.now();
  existing.syncStatus = "pending";

  await db!.put("drafts", existing);
  console.log(`[Offline] Borrador actualizado: ${draftId}`);
}

/**
 * Obtiene todos los borradores de un tenant
 */
export async function getDrafts(tenantId: string): Promise<FacturaDraft[]> {
  if (!db) await initOfflineDB();

  const tx = db!.transaction("drafts", "readonly");
  const index = tx.store.index("by-tenant");
  return await index.getAll(tenantId);
}

/**
 * Obtiene borradores pendientes de sincronizar
 */
export async function getPendingSyncDrafts(): Promise<FacturaDraft[]> {
  if (!db) await initOfflineDB();

  const tx = db!.transaction("drafts", "readonly");
  const index = tx.store.index("by-status");
  return await index.getAll("pending");
}

/**
 * Elimina un borrador
 */
export async function deleteDraft(draftId: string): Promise<void> {
  if (!db) await initOfflineDB();
  await db!.delete("drafts", draftId);
  console.log(`[Offline] Borrador eliminado: ${draftId}`);
}

/**
 * Sincroniza borradores pendientes con el servidor
 */
export async function syncDrafts(
  apiClient: { post: (url: string, data: any) => Promise<any> }
): Promise<{
  synced: number;
  errors: number;
  pending: number;
}> {
  if (!db) await initOfflineDB();

  const pending = await getPendingSyncDrafts();
  let synced = 0;
  let errors = 0;

  for (const draft of pending) {
    try {
      // Marcar como sincronizando
      draft.syncStatus = "syncing";
      await db!.put("drafts", draft);

      // Enviar al servidor
      const response = await apiClient.post("/api/facturas", draft.data);

      // Actualizar estado
      draft.syncStatus = "synced";
      draft.serverFacturaId = response.id;
      await db!.put("drafts", draft);

      synced++;
      console.log(`[Offline] Borrador ${draft.id} sincronizado → ${response.id}`);
    } catch (error: any) {
      // Marcar error
      draft.syncStatus = "error";
      draft.syncError = error.message;
      await db!.put("drafts", draft);

      errors++;
      console.error(`[Offline] Error sincronizando ${draft.id}:`, error.message);
    }
  }

  const stillPending = await getPendingSyncDrafts();

  return {
    synced,
    errors,
    pending: stillPending.length,
  };
}

/**
 * Limpia borradores sincronizados (más de 7 días)
 */
export async function cleanupSyncedDrafts(): Promise<number> {
  if (!db) await initOfflineDB();

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const tx = db!.transaction("drafts", "readwrite");
  const index = tx.store.index("by-status");
  const syncedDrafts = await index.getAll("synced");

  let removed = 0;
  for (const draft of syncedDrafts) {
    if (draft.updatedAt < sevenDaysAgo) {
      await tx.store.delete(draft.id);
      removed++;
    }
  }

  console.log(`[Offline] Limpiados ${removed} borradores sincronizados`);
  return removed;
}

/**
 * Estadísticas de borradores
 */
export async function getOfflineStats(): Promise<{
  total: number;
  pending: number;
  synced: number;
  errors: number;
}> {
  if (!db) await initOfflineDB();

  const all = await db!.getAll("drafts");

  return {
    total: all.length,
    pending: all.filter((d) => d.syncStatus === "pending").length,
    synced: all.filter((d) => d.syncStatus === "synced").length,
    errors: all.filter((d) => d.syncStatus === "error").length,
  };
}
