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
}

export class MHServiceMock implements MHService {
  private procesados: Map<string, SelloMH> = new Map();
  
  async transmitirDTE(factura: Factura, _tenantId: string): Promise<SelloMH> {
    console.log(`[MH Mock] Transmitiendo DTE ${factura.codigoGeneracion}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const exito = Math.random() > 0.05;
    const sello: SelloMH = {
      codigoGeneracion: factura.codigoGeneracion,
      selloRecibido: exito 
        ? `SELLO-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
        : "",
      fechaSello: new Date().toISOString(),
      estado: exito ? "PROCESADO" : "RECHAZADO",
      observaciones: exito ? "Aceptado (Simulación Multi-tenant)" : "Error simulado"
    };
    
    if (exito) this.procesados.set(factura.codigoGeneracion, sello);
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
    
    // TODO: Implementar el login real al API de Hacienda para obtener el Bearer Token
    // Por ahora lanzamos error si no hay token real o simulamos si es necesario
    return "mock-auth-token"; 
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
}

export function createMHService(): MHService {
  const mockMode = process.env.MH_MOCK_MODE === "true";
  return mockMode ? new MHServiceMock() : new MHServiceReal();
}

export const mhService = createMHService();