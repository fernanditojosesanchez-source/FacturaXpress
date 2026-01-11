import type { Factura } from "@shared/schema";
import { storage } from "./storage";
import { signDTE } from "./lib/signer";

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

export interface MHService {
  transmitirDTE(factura: Factura, tenantId: string): Promise<SelloMH>;
  consultarEstado(codigoGeneracion: string, tenantId: string): Promise<EstadoDTE>;
  anularDTE(codigoGeneracion: string, motivo: string, tenantId: string): Promise<ResultadoAnulacion>;
  verificarConexion(tenantId: string): Promise<boolean>;
  verificarDisponibilidad(): Promise<boolean>;
  procesarColaContingencia(tenantId: string): Promise<void>;
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

export function createMHService(): MHService {
  // Por defecto: Usar MOCK (Simulación) en desarrollo si no se especifica lo contrario
  // En producción: Usar REAL por defecto
  const isDev = process.env.NODE_ENV !== "production";
  const forceReal = process.env.MH_MOCK_MODE === "false";
  const forceMock = process.env.MH_MOCK_MODE === "true";

  // Si se fuerza Mock, o si estamos en Dev y no se fuerza Real -> Usar Mock
  if (forceMock || (isDev && !forceReal)) {
    console.log("🛠️  Modo Hacienda: MOCK (Simulación activada)");
    return new MHServiceMock();
  }

  console.log("🔌 Modo Hacienda: REAL (Conectando con API MH)");
  return new MHServiceReal();
}

export const mhService = createMHService();