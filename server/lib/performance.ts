/**
 * Performance Mode - Modo de rendimiento adaptativo
 * Detecta hardware del cliente y ajusta comportamiento
 */

interface PerformanceConfig {
  id: string;
  tenantId: string;
  userId: string;
  enabled: boolean;
  autoDetected: boolean;
  settings: {
    batchSize: number;
    lazyLoadThreshold: number;
    disableAnimations: boolean;
    reducedMotion: boolean;
    simplifiedUI: boolean;
  };
  hardwareInfo?: {
    cores: number;
    memory: number;
    connection: string; // slow-2g, 2g, 3g, 4g
  };
  updatedAt: Date;
}

const performanceConfigs = new Map<string, PerformanceConfig>();

/**
 * Detecta capacidades del hardware y retorna configuración recomendada
 */
export function detectPerformanceProfile(hardwareInfo: {
  cores: number;
  memory: number; // GB
  connection: string;
}): PerformanceConfig["settings"] {
  const { cores, memory, connection } = hardwareInfo;

  // Perfil bajo rendimiento
  if (
    cores <= 2 ||
    memory <= 2 ||
    connection === "slow-2g" ||
    connection === "2g"
  ) {
    return {
      batchSize: 20,
      lazyLoadThreshold: 10,
      disableAnimations: true,
      reducedMotion: true,
      simplifiedUI: true,
    };
  }

  // Perfil medio
  if (cores <= 4 || memory <= 4 || connection === "3g") {
    return {
      batchSize: 50,
      lazyLoadThreshold: 25,
      disableAnimations: false,
      reducedMotion: true,
      simplifiedUI: false,
    };
  }

  // Perfil alto rendimiento
  return {
    batchSize: 100,
    lazyLoadThreshold: 50,
    disableAnimations: false,
    reducedMotion: false,
    simplifiedUI: false,
  };
}

/**
 * Guarda configuración de performance para un usuario
 */
export async function savePerformanceConfig(
  tenantId: string,
  userId: string,
  enabled: boolean,
  settings: PerformanceConfig["settings"],
  hardwareInfo?: PerformanceConfig["hardwareInfo"]
): Promise<void> {
  const config: PerformanceConfig = {
    id: `${tenantId}-${userId}`,
    tenantId,
    userId,
    enabled,
    autoDetected: !!hardwareInfo,
    settings,
    hardwareInfo,
    updatedAt: new Date(),
  };

  performanceConfigs.set(config.id, config);

  console.log(
    `[Performance] Config guardada para usuario ${userId}: enabled=${enabled}, batch=${settings.batchSize}`
  );
}

/**
 * Obtiene configuración de performance de un usuario
 */
export function getPerformanceConfig(
  tenantId: string,
  userId: string
): PerformanceConfig | null {
  const id = `${tenantId}-${userId}`;
  return performanceConfigs.get(id) || null;
}

/**
 * Aplica optimizaciones en batch inserts según performance mode
 */
export async function batchInsertOptimized<T extends Record<string, any>>(
  tableName: string,
  records: T[],
  tenantId: string,
  userId: string
): Promise<{ inserted: number; batches: number }> {
  const config = getPerformanceConfig(tenantId, userId);
  const batchSize = config?.enabled ? config.settings.batchSize : 100;

  let inserted = 0;
  let batches = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    // Construir query de inserción dinámica
    // Nota: En producción usar métodos específicos de Drizzle por tabla
    try {
      // await db.insert(table).values(batch);
      inserted += batch.length;
      batches++;
    } catch (error) {
      console.error(`[Performance] Error en batch ${batches}:`, error);
      throw error;
    }
  }

  console.log(
    `[Performance] Insertados ${inserted} registros en ${batches} batches (size: ${batchSize})`
  );

  return { inserted, batches };
}

/**
 * Estadísticas de performance configs activas
 */
export function getPerformanceStats(): {
  total: number;
  enabled: number;
  autoDetected: number;
  byProfile: Record<string, number>;
} {
  let enabled = 0;
  let autoDetected = 0;
  const byProfile: Record<string, number> = {
    low: 0,
    medium: 0,
    high: 0,
  };

  for (const config of performanceConfigs.values()) {
    if (config.enabled) enabled++;
    if (config.autoDetected) autoDetected++;

    // Clasificar perfil
    if (config.settings.batchSize <= 20) {
      byProfile.low++;
    } else if (config.settings.batchSize <= 50) {
      byProfile.medium++;
    } else {
      byProfile.high++;
    }
  }

  return {
    total: performanceConfigs.size,
    enabled,
    autoDetected,
    byProfile,
  };
}
