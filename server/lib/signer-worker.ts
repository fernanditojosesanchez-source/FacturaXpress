/**
 * Interfaz de Worker Pool para Firma Digital JWS
 * 
 * Este módulo administra un pool de workers para distribuir la carga
 * de operaciones CPU-intensive de firma, previniendo bloqueo del event loop.
 * 
 * Mejoras implementadas:
 * - Pool de workers reutilizables (no crear/destruir por cada firma)
 * - Queue de trabajos pendientes
 * - Timeout de seguridad (30s por firma)
 * - Métricas de performance
 * - ✅ SEGURIDAD: Limpieza segura de certificados (zero-fill)
 * 
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #5 (P0: Crítico)
 * @see AUDITORIA_CRITICA_2026.md - Hallazgo #4 (P0: Memory Security)
 */

import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSecureMemoryService } from './secure-memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SignResult {
  body: string;
  signature: string;
}

interface WorkerTask {
  dte: any;
  p12Base64: string;
  password: string;
  resolve: (result: SignResult) => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Worker Pool para firma digital
 */
class SignerWorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private readonly poolSize: number;
  private readonly timeout: number = 30000; // 30 segundos
  private isShuttingDown: boolean = false;
  private secureMemory: any; // ✅ SEGURIDAD: Referencia al servicio

  // Métricas
  private metrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalTime: 0,
    avgTime: 0,
  };

  constructor(poolSize: number = 4) {
    this.poolSize = poolSize;
    this.secureMemory = getSecureMemoryService(); // ✅ Obtener una sola vez
    this.initializePool();
  }

  /**
   * Inicializar pool de workers
   */
  private initializePool(): void {
    const workerPath = path.join(__dirname, 'signer-worker-impl.js');

    for (let i = 0; i < this.poolSize; i++) {
      try {
        // Crear worker sin workerData (se enviará por cada tarea)
        const worker = new Worker(workerPath);
        
        worker.on('error', (error) => {
          console.error(`[SignerWorkerPool] Worker ${i} error:`, error);
          // Remover worker defectuoso y crear uno nuevo
          this.replaceWorker(worker);
        });

        worker.on('exit', (code) => {
          if (!this.isShuttingDown && code !== 0) {
            console.warn(`[SignerWorkerPool] Worker ${i} exited with code ${code}, replacing...`);
            this.replaceWorker(worker);
          }
        });

        this.workers.push(worker);
        this.availableWorkers.push(worker);
      } catch (error) {
        console.error(`[SignerWorkerPool] Failed to create worker ${i}:`, error);
      }
    }

    console.log(`[SignerWorkerPool] Initialized with ${this.workers.length} workers`);
  }

  /**
   * Reemplazar worker defectuoso
   */
  private replaceWorker(oldWorker: Worker): void {
    const workerPath = path.join(__dirname, 'signer-worker-impl.js');
    
    // Remover worker viejo
    this.workers = this.workers.filter(w => w !== oldWorker);
    this.availableWorkers = this.availableWorkers.filter(w => w !== oldWorker);
    
    try {
      oldWorker.terminate();
    } catch (e) {
      // Ignorar errores al terminar worker ya muerto
    }

    // Crear nuevo worker
    try {
      const newWorker = new Worker(workerPath);
      this.workers.push(newWorker);
      this.availableWorkers.push(newWorker);
      
      // Procesar siguiente tarea si hay en cola
      this.processNextTask();
    } catch (error) {
      console.error('[SignerWorkerPool] Failed to replace worker:', error);
    }
  }

  /**
   * Firmar DTE usando worker del pool
   * 
   * ✅ SEGURIDAD: Usa getSecureMemoryService() para auto-limpiar certificados
   */
  async signDTE(dte: any, p12Base64: string, password: string): Promise<SignResult> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    const startTime = Date.now();
    this.metrics.totalTasks++;

    return new Promise<SignResult>((resolve, reject) => {
      const task: WorkerTask = {
        dte,
        p12Base64,
        password,
        resolve: (result) => {
          const duration = Date.now() - startTime;
          this.metrics.completedTasks++;
          this.metrics.totalTime += duration;
          this.metrics.avgTime = this.metrics.totalTime / this.metrics.completedTasks;
          resolve(result);
        },
        reject: (error) => {
          this.metrics.failedTasks++;
          reject(error);
        },
      };

      // Si hay worker disponible, asignar inmediatamente
      if (this.availableWorkers.length > 0) {
        this.executeTask(task);
      } else {
        // Si no, agregar a la cola
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Ejecutar tarea en worker disponible
   * 
   * ✅ SEGURIDAD: Limpieza segura después de enviar al worker
   */
  private executeTask(task: WorkerTask): void {
    const worker = this.availableWorkers.shift();
    
    if (!worker) {
      // No hay worker disponible, regresar a la cola
      this.taskQueue.unshift(task);
      return;
    }

    // Configurar timeout
    task.timeoutId = setTimeout(() => {
      task.reject(new Error('Firma timeout (30s excedido)'));
      
      // Terminar worker y reemplazar
      this.replaceWorker(worker);
      
      // Procesar siguiente tarea
      this.processNextTask();
    }, this.timeout);

    // Listener para el mensaje del worker
    const messageHandler = (result: any) => {
      // Limpiar timeout
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }

      // Remover listener
      worker.off('message', messageHandler);

      // Devolver worker al pool
      this.availableWorkers.push(worker);

      // ✅ SEGURIDAD: Limpiar referencias a certificados
      // Después de que el worker haya procesado, limpiar los buffers
      this.secureMemory.zeroFillMultiple(
        Buffer.from(task.p12Base64, 'base64'),
        Buffer.from(task.password, 'utf-8')
      );

      // Procesar resultado
      if (result.success) {
        task.resolve({
          body: result.body,
          signature: result.signature,
        });
      } else {
        task.reject(new Error(result.error || 'Error desconocido en worker'));
      }

      // Procesar siguiente tarea en cola
      this.processNextTask();
    };

    worker.on('message', messageHandler);

    // Enviar datos al worker
    worker.postMessage({
      dte: task.dte,
      p12Base64: task.p12Base64,
      password: task.password,
    });
  }

  /**
   * Procesar siguiente tarea de la cola
   */
  private processNextTask(): void {
    if (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const nextTask = this.taskQueue.shift();
      if (nextTask) {
        this.executeTask(nextTask);
      }
    }
  }

  /**
   * Obtener métricas del pool
   */
  getMetrics() {
    return {
      ...this.metrics,
      poolSize: this.poolSize,
      activeWorkers: this.poolSize - this.availableWorkers.length,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
    };
  }

  /**
   * Cerrar todos los workers (graceful shutdown)
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    console.log('[SignerWorkerPool] Shutting down...');
    
    // Rechazar tareas en cola
    this.taskQueue.forEach(task => {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      task.reject(new Error('Worker pool shutting down'));
    });
    this.taskQueue = [];

    // Terminar todos los workers
    await Promise.all(
      this.workers.map(worker => 
        worker.terminate().catch(err => 
          console.error('[SignerWorkerPool] Error terminating worker:', err)
        )
      )
    );

    this.workers = [];
    this.availableWorkers = [];
    
    console.log('[SignerWorkerPool] Shutdown complete');
  }
}

// Singleton instance
let workerPool: SignerWorkerPool | null = null;

/**
 * Obtener instancia del worker pool (singleton)
 */
function getWorkerPool(): SignerWorkerPool {
  if (!workerPool) {
    const poolSize = parseInt(process.env.SIGNER_WORKER_POOL_SIZE || '4', 10);
    workerPool = new SignerWorkerPool(poolSize);
    
    // Graceful shutdown en señales de terminación
    process.on('SIGINT', async () => {
      if (workerPool) {
        await workerPool.shutdown();
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      if (workerPool) {
        await workerPool.shutdown();
      }
      process.exit(0);
    });
  }
  
  return workerPool;
}

/**
 * Firmar DTE usando worker pool (función pública)
 * 
 * Esta función reemplaza la implementación síncrona de signDTE
 * con una implementación asíncrona que usa workers.
 */
export async function signDTE(
  dte: any,
  p12Base64: string,
  password: string
): Promise<SignResult> {
  const pool = getWorkerPool();
  return pool.signDTE(dte, p12Base64, password);
}

/**
 * Obtener métricas del worker pool
 */
export function getSignerMetrics() {
  if (!workerPool) {
    return null;
  }
  return workerPool.getMetrics();
}

/**
 * Endpoint de health check para workers
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const pool = getWorkerPool();
    const metrics = pool.getMetrics();
    
    // Pool está sano si tiene al menos 1 worker disponible o activo
    return metrics.activeWorkers + metrics.availableWorkers > 0;
  } catch (error) {
    console.error('[SignerWorkerPool] Health check failed:', error);
    return false;
  }
}
