/**
 * Sincronización automática de esquemas DGII/MH
 * Descarga, versionado, activación y rollback de schemas JSON
 */

import { createHash } from "crypto";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { sendToSIEM } from "./siem.js";

interface SchemaVersion {
  id: string;
  schemaType: string; // 'factura', 'ccf', 'nota-credito', etc.
  version: string;
  url: string;
  hash: string;
  downloaded: Date;
  active: boolean;
  content?: any;
}

interface SchemaSource {
  type: string;
  url: string;
  checksum?: string;
}

// URLs de esquemas oficiales del MH (configurables por ENV)
const SCHEMA_SOURCES: SchemaSource[] = [
  {
    type: "factura",
    url: process.env.MH_SCHEMA_FACTURA_URL || "https://dte.mh.gob.sv/schemas/factura-v1.json",
  },
  {
    type: "ccf",
    url: process.env.MH_SCHEMA_CCF_URL || "https://dte.mh.gob.sv/schemas/ccf-v1.json",
  },
  {
    type: "nota-credito",
    url: process.env.MH_SCHEMA_NC_URL || "https://dte.mh.gob.sv/schemas/nota-credito-v1.json",
  },
];

const SCHEMA_DIR = process.env.SCHEMA_STORAGE_DIR || "./server/dgii-resources/versions";
const CHECK_INTERVAL = parseInt(process.env.SCHEMA_SYNC_INTERVAL_HOURS || "24", 10) * 60 * 60 * 1000;

// Estado en memoria de versiones activas
const activeSchemas = new Map<string, SchemaVersion>();

/**
 * Calcula hash SHA256 de contenido
 */
function calculateHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}

/**
 * Descarga un schema desde URL
 */
async function downloadSchema(source: SchemaSource): Promise<{ content: any; hash: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "FacturaXpress/2.0",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[SchemaSync] Error descargando ${source.type}: HTTP ${response.status}`);
      return null;
    }

    const content = await response.json();
    const contentStr = JSON.stringify(content);
    const hash = calculateHash(contentStr);

    return { content, hash };
  } catch (error) {
    console.error(`[SchemaSync] Error descargando ${source.type}:`, (error as Error).message);
    return null;
  }
}

/**
 * Guarda schema en disco con versionado
 */
async function saveSchemaVersion(type: string, version: string, content: any): Promise<void> {
  if (!existsSync(SCHEMA_DIR)) {
    await mkdir(SCHEMA_DIR, { recursive: true });
  }

  const filename = `${type}-${version}.json`;
  const filepath = join(SCHEMA_DIR, filename);

  await writeFile(filepath, JSON.stringify(content, null, 2), "utf-8");
  console.log(`[SchemaSync] Schema guardado: ${filename}`);
}

/**
 * Carga schema desde disco
 */
async function loadSchemaVersion(type: string, version: string): Promise<any | null> {
  try {
    const filename = `${type}-${version}.json`;
    const filepath = join(SCHEMA_DIR, filename);

    if (!existsSync(filepath)) {
      return null;
    }

    const content = await readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`[SchemaSync] Error cargando schema ${type} v${version}:`, (error as Error).message);
    return null;
  }
}

/**
 * Verifica y descarga actualizaciones de schemas
 */
export async function syncSchemas(): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  console.log("[SchemaSync] Iniciando sincronización de schemas...");

  for (const source of SCHEMA_SOURCES) {
    try {
      const result = await downloadSchema(source);
      if (!result) {
        errors.push(`Failed to download ${source.type}`);
        continue;
      }

      const { content, hash } = result;
      const version = `v${Date.now()}`; // Versión basada en timestamp

      // Verificar si ya existe esta versión
      const currentActive = activeSchemas.get(source.type);
      if (currentActive && currentActive.hash === hash) {
        console.log(`[SchemaSync] ${source.type}: Sin cambios (hash: ${hash})`);
        continue;
      }

      // Guardar nueva versión
      await saveSchemaVersion(source.type, version, content);

      // Actualizar versión activa en memoria
      const newVersion: SchemaVersion = {
        id: `${source.type}-${version}`,
        schemaType: source.type,
        version,
        url: source.url,
        hash,
        downloaded: new Date(),
        active: true,
        content,
      };

      activeSchemas.set(source.type, newVersion);
      updated++;

      // Evento SIEM
      await sendToSIEM({
        type: "schema_updated",
        level: "info",
        details: {
          schemaType: source.type,
          version,
          hash,
          previousHash: currentActive?.hash,
        },
      });

      console.log(`[SchemaSync] ✅ ${source.type} actualizado a ${version} (hash: ${hash})`);
    } catch (error) {
      const errorMsg = `Error syncing ${source.type}: ${(error as Error).message}`;
      errors.push(errorMsg);
      console.error(`[SchemaSync] ${errorMsg}`);

      await sendToSIEM({
        type: "schema_sync_error",
        level: "error",
        details: { schemaType: source.type, error: (error as Error).message },
      });
    }
  }

  console.log(`[SchemaSync] Sincronización completada: ${updated} actualizado(s), ${errors.length} error(es)`);
  return { updated, errors };
}

/**
 * Obtiene schema activo por tipo
 */
export function getActiveSchema(type: string): any | null {
  const version = activeSchemas.get(type);
  return version?.content || null;
}

/**
 * Lista todas las versiones disponibles
 */
export function listSchemaVersions(): SchemaVersion[] {
  return Array.from(activeSchemas.values());
}

/**
 * Activa una versión específica de schema (rollback)
 */
export async function activateSchemaVersion(type: string, version: string): Promise<boolean> {
  try {
    const content = await loadSchemaVersion(type, version);
    if (!content) {
      console.error(`[SchemaSync] Versión no encontrada: ${type} ${version}`);
      return false;
    }

    const hash = calculateHash(JSON.stringify(content));
    const schemaVersion: SchemaVersion = {
      id: `${type}-${version}`,
      schemaType: type,
      version,
      url: "local",
      hash,
      downloaded: new Date(),
      active: true,
      content,
    };

    activeSchemas.set(type, schemaVersion);

    await sendToSIEM({
      type: "schema_activated",
      level: "info",
      details: { schemaType: type, version, hash },
    });

    console.log(`[SchemaSync] ✅ Activado ${type} versión ${version}`);
    return true;
  } catch (error) {
    console.error(`[SchemaSync] Error activando schema:`, (error as Error).message);
    return false;
  }
}

/**
 * Inicia el scheduler de sincronización
 */
export function startSchemaSync(): NodeJS.Timeout | null {
  const enabled = process.env.SCHEMA_SYNC_ENABLED !== "false"; // Habilitado por defecto

  if (!enabled) {
    console.log("[SchemaSync] Sincronización deshabilitada (SCHEMA_SYNC_ENABLED=false)");
    return null;
  }

  console.log(`[SchemaSync] Scheduler iniciado (intervalo: ${CHECK_INTERVAL / 1000 / 60 / 60}h)`);

  // Ejecutar inmediatamente al inicio
  syncSchemas().catch((err) => {
    console.error("[SchemaSync] Error en sincronización inicial:", err);
  });

  // Programar ejecuciones periódicas
  return setInterval(() => {
    syncSchemas().catch((err) => {
      console.error("[SchemaSync] Error en sincronización periódica:", err);
    });
  }, CHECK_INTERVAL);
}

/**
 * Detiene el scheduler
 */
export function stopSchemaSync(timer: NodeJS.Timeout | null): void {
  if (timer) {
    clearInterval(timer);
    console.log("[SchemaSync] Scheduler detenido");
  }
}

/**
 * Obtiene estadísticas de sincronización
 */
export function getSchemaSyncStats(): {
  activeVersions: number;
  schemas: Array<{ type: string; version: string; hash: string; downloaded: Date }>;
} {
  const schemas = Array.from(activeSchemas.values()).map((s) => ({
    type: s.schemaType,
    version: s.version,
    hash: s.hash,
    downloaded: s.downloaded,
  }));

  return {
    activeVersions: activeSchemas.size,
    schemas,
  };
}
