import type { Factura } from "@shared/schema";
import { storage } from "./storage";
import { signDTE } from "./lib/signer";
import { getMHCircuitBreaker, CircuitState } from "./lib/circuit-breaker";

export interface SelloMH {
  codigoGeneracion: string;
  selloRecibido: string;
  fechaSello: string;
  estado: "PROCESADO" | "RECHAZADO" | "PENDIENTE";
  observaciones?: string;
}

export interface EstadoDTE {
  estado: "ACEPTADO" | "RECHAZADO" | "PROCESANDO" | "NO_ENCONTRADO";
  mensaje: string;
  fechaConsulta: string;
}

export interface ResultadoAnulacion {
  success: boolean;
  mensaje: string;
  fechaAnulacion: string;
}

export interface ResultadoInvalidacion {
  success: boolean;
  mensaje: string;
  selloAnulacion?: string;
  fechaAnulo: string;
}

export interface MHService {
  transmitirDTE(factura: Factura, tenantId: string): Promise<SelloMH>;
  consultarEstado(codigoGeneracion: string, tenantId: string): Promise<EstadoDTE>;
  anularDTE(codigoGeneracion: string, motivo: string, tenantId: string): Promise<ResultadoAnulacion>;
  invalidarDTE(codigoGeneracion: string, motivo: string, tenantId: string): Promise<ResultadoInvalidacion>;
  procesarAnulacionesPendientes(tenantId: string): Promise<void>;
  verificarConexion(tenantId: string): Promise<boolean>;
  verificarDisponibilidad(): Promise<boolean>;
  procesarColaContingencia(tenantId: string): Promise<void>;
  getCircuitState?: () => any;
}

export class MHServiceMock implements MHService {
  private procesados: Map<string, SelloMH> = new Map();
  
  async transmitirDTE(factura: Factura, _tenantId: string): Promise<SelloMH> {
    console.log(`[MH Mock] Transmitiendo DTE ${factura.codigoGeneracion}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const exito = Math.random() > 0.05;
    const sello: SelloMH = {
      codigoGeneracion: factura.codigoGeneracion || "",
      selloRecibido: exito 
        ? `SELLO-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
        : "",
      fechaSello: new Date().toISOString(),
      estado: exito ? "PROCESADO" : "RECHAZADO",
      observaciones: exito ? "Aceptado (Simulación Multi-tenant)" : "Error simulado"
    };
    
    if (exito) this.procesados.set(factura.codigoGeneracion || "", sello);
    return sello;
  }
  
  async consultarEstado(codigoGeneracion: string, _tenantId: string): Promise<EstadoDTE> {
    const sello = this.procesados.get(codigoGeneracion);
    return {
      estado: sello ? "ACEPTADO" : "NO_ENCONTRADO",
      mensaje: sello ? "Encontrado" : "No encontrado",
      fechaConsulta: new Date().toISOString()
    };
  }

  async anularDTE(codigoGeneracion: string, _motivo: string, _tenantId: string): Promise<ResultadoAnulacion> {
    this.procesados.delete(codigoGeneracion);
    return { success: true, mensaje: "Anulado", fechaAnulacion: new Date().toISOString() };
  }

  async invalidarDTE(codigoGeneracion: string, _motivo: string, _tenantId: string): Promise<ResultadoInvalidacion> {
    console.log(`[MH Mock] Invalidando DTE ${codigoGeneracion}`);
    this.procesados.delete(codigoGeneracion);
    return { 
      success: true, 
      mensaje: "DTE invalidado (Simulación)",
      selloAnulacion: `ANULO-${Date.now()}`,
      fechaAnulo: new Date().toISOString()
    };
  }

  async procesarAnulacionesPendientes(_tenantId: string): Promise<void> {
    // Mock procesa automáticamente
    console.log(`[Anulación] Cola procesada en Mock`);
  }

  async verificarConexion(_tenantId: string): Promise<boolean> { return true; }

  async verificarDisponibilidad(): Promise<boolean> {
    // Mock siempre disponible
    return true;
  }

  async procesarColaContingencia(tenantId: string): Promise<void> {
    // Mock procesa automáticamente
    console.log(`[Contingencia] Cola de ${tenantId} procesada en Mock`);
  }
}

export class MHServiceReal implements MHService {
  private apiUrl: string;
  
  constructor() {
    this.apiUrl = process.env.MH_API_URL || "https://api.mh.gob.sv";
  }
  
  private async getAuthToken(tenantId: string): Promise<string> {
    const creds = await storage.getTenantCredentials(tenantId);
    if (!creds || !creds.mhUsuario || !creds.mhPass) {
      throw new Error("Credenciales del Ministerio de Hacienda no configuradas para este Tenant.");
    }
    
    // Si estamos en modo simulación (o falta URL), usamos token falso
    if (process.env.MH_MOCK_MODE === "true" || !this.apiUrl) {
      return "mock-auth-token";
    }

    try {
      // Autenticación Real con Hacienda
      const authUrl = `${this.apiUrl}/seguridad/auth`;
      const params = new URLSearchParams();
      params.append("user", creds.mhUsuario);
      params.append("pwd", creds.mhPass);

      const response = await fetch(authUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fallo autenticación MH (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      if (!data.body || !data.body.token) {
        throw new Error("Respuesta de autenticación MH inválida: No se recibió token");
      }

      return data.body.token;
    } catch (error) {
      console.error("[MH Auth] Error al obtener token:", error);
      throw error;
    }
  }

  async transmitirDTE(factura: Factura, tenantId: string): Promise<SelloMH> {
    const creds = await storage.getTenantCredentials(tenantId);
    if (!creds || !creds.certificadoP12 || !creds.certificadoPass) {
      throw new Error("Certificado digital no configurado para este Tenant.");
    }

    // 1. Firmar el DTE dinámicamente con las credenciales del Tenant
    console.log(`[MH Real] Firmando DTE para tenant ${tenantId}...`);
    const { body: jwsFirmado } = await signDTE(
      factura, 
      creds.certificadoP12, 
      creds.certificadoPass
    );

    // 2. Transmitir a Hacienda
    const token = await this.getAuthToken(tenantId);
    
    try {
      const response = await fetch(`${this.apiUrl}/recepcion-dte`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ambiente: creds.ambiente || "00",
          idEnvio: 1, // Incremental
          version: 1,
          documento: jwsFirmado // El JWS compacto
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error MH: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("[MH Real] Error:", error);
      throw error;
    }
  }

  async consultarEstado(codigoGeneracion: string, tenantId: string): Promise<EstadoDTE> {
    const token = await this.getAuthToken(tenantId);
    const response = await fetch(`${this.apiUrl}/consulta/${codigoGeneracion}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    return await response.json();
  }

  async anularDTE(codigoGeneracion: string, motivo: string, tenantId: string): Promise<ResultadoAnulacion> {
    const token = await this.getAuthToken(tenantId);
    // ... Implementación real ...
    return { success: false, mensaje: "No implementado", fechaAnulacion: "" };
  }

  async invalidarDTE(codigoGeneracion: string, motivo: string, tenantId: string): Promise<ResultadoInvalidacion> {
    console.log(`[MH Real] Invalidando DTE ${codigoGeneracion} con motivo: ${motivo}`);
    
    try {
      const token = await this.getAuthToken(tenantId);
      const creds = await storage.getTenantCredentials(tenantId);
      if (!creds) throw new Error("Credenciales no configuradas");

      // 1. Crear documento de invocación (invalidación)
      const invocacion = {
        ambiente: creds.ambiente || "00",
        codigoGeneracion: codigoGeneracion,
        motivo: motivo, // 01-05 según DGII
        descripcion: `Invalidación por motivo ${motivo}`
      };

      // 2. Firma del documento (cuando llegue certificado real)
      // Por ahora retornamos estructura lista para producción
      const response = await fetch(`${this.apiUrl}/invalidacion`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(invocacion)
      });

      if (!response.ok) {
        throw new Error(`Error MH invalidación: ${response.status}`);
      }

      const resultado = await response.json();
      return {
        success: true,
        mensaje: "DTE invalidado correctamente",
        selloAnulacion: resultado.selloAnulacion,
        fechaAnulo: new Date().toISOString()
      };
    } catch (error) {
      console.error("[MH Real] Error en invalidación:", error);
      throw error;
    }
  }

  async procesarAnulacionesPendientes(tenantId: string): Promise<void> {
    console.log(`[Anulación] Procesando anulaciones pendientes para tenant ${tenantId}...`);
    
    const pendientes = await storage.getAnulacionesPendientes(tenantId);
    
    for (const item of pendientes) {
      try {
        await storage.updateAnulacionStatus(item.codigoGeneracion, "procesando");
        
        const resultado = await this.invalidarDTE(item.codigoGeneracion, item.motivo, tenantId);
        
        if (resultado.success) {
          await storage.updateAnulacionStatus(
            item.codigoGeneracion,
            "aceptado",
            resultado.selloAnulacion,
            { fechaAnulo: resultado.fechaAnulo }
          );
          console.log(`[Anulación] ✅ DTE ${item.codigoGeneracion} invalidado exitosamente`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Error desconocido";
        await storage.updateAnulacionStatus(item.codigoGeneracion, "pendiente", undefined, undefined, errorMsg);
        
        const record = await storage.getAnulacion(item.codigoGeneracion, tenantId);
        if (record && record.intentosFallidos > 10) {
          await storage.updateAnulacionStatus(item.codigoGeneracion, "error", undefined, undefined, errorMsg);
          console.error(`[Anulación] ❌ DTE ${item.codigoGeneracion} marca do como error tras 10 intentos`);
        }
      }
    }
  }

  async verificarConexion(_tenantId: string): Promise<boolean> {
    return true;
  }

  async verificarDisponibilidad(): Promise<boolean> {
    try {
      // Hacer un ping simple al API del MH
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.apiUrl}/status`, {
        method: "GET",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error("[MH Real] Servicio no disponible:", error);
      return false;
    }
  }

  async procesarColaContingencia(tenantId: string): Promise<void> {
    console.log(`[Contingencia] Procesando cola pendiente para tenant ${tenantId}...`);
    
    const pendientes = await storage.getContingenciaQueue(tenantId, "pendiente");
    
    for (const item of pendientes) {
      try {
        await storage.updateContingenciaStatus(item.codigoGeneracion, "procesando");
        
        // Obtener factura original
        const factura = await storage.getFactura(item.facturaId, tenantId);
        if (!factura) {
          throw new Error(`Factura ${item.facturaId} no encontrada`);
        }

        // Reintentar transmisión
        const resultado = await this.transmitirDTE(factura, tenantId);
        
        if (resultado.estado === "PROCESADO") {
          await storage.marcarContingenciaCompleta(item.codigoGeneracion);
          console.log(`[Contingencia] ✅ DTE ${item.codigoGeneracion} transmitido exitosamente`);
        } else {
          throw new Error(`Rechazo del MH: ${resultado.observaciones}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Error desconocido";
        await storage.updateContingenciaStatus(item.codigoGeneracion, "pendiente", errorMsg);
        
        // Si falló más de 10 veces, marcar como error
        const record = await storage.getContingenciaQueue(tenantId, "pendiente");
        const fallidoRecord = record.find(r => r.codigoGeneracion === item.codigoGeneracion);
        if (fallidoRecord && fallidoRecord.intentosFallidos > 10) {
          await storage.updateContingenciaStatus(item.codigoGeneracion, "error", errorMsg);
          console.error(`[Contingencia] ❌ DTE ${item.codigoGeneracion} marca do como error tras 10 intentos`);
        }
      }
    }
  }
}

/**
 * MHServiceWithBreaker: Envuelve el servicio real con Circuit Breaker
 * Protege contra cascadas de fallos cuando MH está caído
 * 
 * Estados del Circuit:
 * - CLOSED (Normal): Requests van directo a MH
 * - OPEN (Caído): Requests fallan rápido, se encolan en contingencia
 * - HALF_OPEN (Probando): 1 request de prueba, si pasa → CLOSED
 * 
 * Cuando el circuit está OPEN:
 * - transmitirDTE: Encola en contingencia automáticamente
 * - anularDTE/invalidarDTE: Encola también
 * - consultarEstado: Intenta desde cache o retorna "NO_ENCONTRADO"
 */
export class MHServiceWithBreaker implements MHService {
  private innerService: MHService;
  private breaker = getMHCircuitBreaker();

  constructor(innerService: MHService) {
    this.innerService = innerService;
  }

  async transmitirDTE(factura: Factura, tenantId: string): Promise<SelloMH> {
    // Si circuit está abierto, encolar en contingencia automáticamente
    if (this.breaker.isOpen()) {
      console.warn(
        `🔴 Circuit OPEN: Encolando DTE ${factura.codigoGeneracion} en contingencia`
      );
      
      // Encolar en contingencia para reintento posterior
      await storage.enqueueContinencia({
        codigoGeneracion: factura.codigoGeneracion || "",
        facturaId: factura.id || "",
        tenantId,
        estado: "pendiente"
      });

      // Retornar respuesta de "aceptado temporalmente"
      return {
        codigoGeneracion: factura.codigoGeneracion || "",
        selloRecibido: `TEMP-${Date.now()}`, // Sello temporal
        fechaSello: new Date().toISOString(),
        estado: "PENDIENTE",
        observaciones: "Encolado en contingencia por MH no disponible"
      };
    }

    try {
      return await this.breaker.execute(() =>
        this.innerService.transmitirDTE(factura, tenantId)
      );
    } catch (error) {
      // Si circuit abre por fallos, encolar también
      if (this.breaker.isOpen()) {
        await storage.enqueueContinencia({
          codigoGeneracion: factura.codigoGeneracion || "",
          facturaId: factura.id || "",
          tenantId,
          estado: "pendiente"
        });
      }
      throw error;
    }
  }

  async consultarEstado(codigoGeneracion: string, tenantId: string): Promise<EstadoDTE> {
    // No bloquear consultas por circuit abierto
    // Intentar en todos los casos
    try {
      return await this.breaker.execute(() =>
        this.innerService.consultarEstado(codigoGeneracion, tenantId)
      );
    } catch (error) {
      // Si falla por circuit, retornar "NO_ENCONTRADO" con aviso
      if (this.breaker.isOpen()) {
        return {
          estado: "NO_ENCONTRADO",
          mensaje: "MH no disponible temporalmente. Intente más tarde.",
          fechaConsulta: new Date().toISOString()
        };
      }
      throw error;
    }
  }

  async anularDTE(
    codigoGeneracion: string,
    motivo: string,
    tenantId: string
  ): Promise<ResultadoAnulacion> {
    if (this.breaker.isOpen()) {
      console.warn(`🔴 Circuit OPEN: Encolando anulación ${codigoGeneracion} en contingencia`);
      
      // Encolar anulación para procesamiento posterior
      await storage.enqueueAnulacion({
        codigoGeneracion,
        motivo,
        tenantId,
        estado: "pendiente"
      });

      return {
        success: true,
        mensaje: "Anulación encolada en contingencia",
        fechaAnulacion: new Date().toISOString()
      };
    }

    try {
      return await this.breaker.execute(() =>
        this.innerService.anularDTE(codigoGeneracion, motivo, tenantId)
      );
    } catch (error) {
      // Si circuit abre por fallos, encolar también
      if (this.breaker.isOpen()) {
        await storage.enqueueAnulacion({
          codigoGeneracion,
          motivo,
          tenantId,
          estado: "pendiente"
        });
      }
      throw error;
    }
  }

  async invalidarDTE(
    codigoGeneracion: string,
    motivo: string,
    tenantId: string
  ): Promise<ResultadoInvalidacion> {
    if (this.breaker.isOpen()) {
      console.warn(
        `🔴 Circuit OPEN: Encolando invalidación ${codigoGeneracion} en contingencia`
      );

      await storage.enqueueAnulacion({
        codigoGeneracion,
        motivo,
        tenantId,
        estado: "pendiente"
      });

      return {
        success: true,
        mensaje: "Invalidación encolada en contingencia",
        selloAnulacion: `TEMP-${Date.now()}`,
        fechaAnulo: new Date().toISOString()
      };
    }

    try {
      return await this.breaker.execute(() =>
        this.innerService.invalidarDTE(codigoGeneracion, motivo, tenantId)
      );
    } catch (error) {
      if (this.breaker.isOpen()) {
        await storage.enqueueAnulacion({
          codigoGeneracion,
          motivo,
          tenantId,
          estado: "pendiente"
        });
      }
      throw error;
    }
  }

  async procesarAnulacionesPendientes(tenantId: string): Promise<void> {
    // Procesar solo si circuit está disponible
    if (!this.breaker.isOpen()) {
      try {
        return await this.breaker.execute(() =>
          this.innerService.procesarAnulacionesPendientes(tenantId)
        );
      } catch (error) {
        console.error("[Circuit Breaker] Error procesando anulaciones:", error);
        // No relanzar; permitir reintentos posteriores
      }
    }
  }

  async verificarConexion(tenantId: string): Promise<boolean> {
    try {
      return await this.breaker.execute(() =>
        this.innerService.verificarConexion(tenantId)
      );
    } catch {
      return false;
    }
  }

  async verificarDisponibilidad(): Promise<boolean> {
    try {
      return await this.breaker.execute(() =>
        this.innerService.verificarDisponibilidad()
      );
    } catch {
      return false;
    }
  }

  async procesarColaContingencia(tenantId: string): Promise<void> {
    // Procesar cola de contingencia (puede hacerse aunque circuit esté abierto)
    try {
      await this.innerService.procesarColaContingencia(tenantId);
      // Si tiene éxito, registrar el éxito en el breaker
      this.breaker.recordSuccess();
    } catch (error) {
      // No registrar como fallo del breaker; la cola de contingencia es fallback
      console.error("[Contingencia] Error procesando cola:", error);
    }
  }

  /**
   * Obtener estado actual del Circuit Breaker para monitoreo
   */
  getCircuitState() {
    return this.breaker.getStatus();
  }

  /**
   * Reset manual del circuit (usar con cuidado)
   */
  resetCircuit() {
    this.breaker.reset();
    console.log("🔧 Circuit Breaker reset manual");
  }
}

export function createMHService(): MHService {
  // Por defecto: Usar MOCK (Simulación) en desarrollo si no se especifica lo contrario
  // En producción: Usar REAL por defecto
  const isDev = process.env.NODE_ENV !== "production";
  const forceReal = process.env.MH_MOCK_MODE === "false";
  const forceMock = process.env.MH_MOCK_MODE === "true";

  let innerService: MHService;

  // Si se fuerza Mock, o si estamos en Dev y no se fuerza Real -> Usar Mock
  if (forceMock || (isDev && !forceReal)) {
    console.log("🛠️  Modo Hacienda: MOCK (Simulación activada)");
    innerService = new MHServiceMock();
  } else {
    console.log("🔌 Modo Hacienda: REAL (Conectando con API MH)");
    innerService = new MHServiceReal();
  }

  // Envolver con Circuit Breaker
  return new MHServiceWithBreaker(innerService);
}

export const mhService = createMHService();