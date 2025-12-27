import type { Factura } from "@shared/schema";

// Tipos para respuestas del Ministerio de Hacienda
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

// Interfaz del servicio MH
export interface MHService {
  transmitirDTE(factura: Factura): Promise<SelloMH>;
  consultarEstado(codigoGeneracion: string): Promise<EstadoDTE>;
  anularDTE(codigoGeneracion: string, motivo: string): Promise<ResultadoAnulacion>;
  verificarConexion(): Promise<boolean>;
}

// ============================================
// IMPLEMENTACIÓN MOCK (para desarrollo sin certificado)
// ============================================
export class MHServiceMock implements MHService {
  private procesados: Map<string, SelloMH> = new Map();
  
  async transmitirDTE(factura: Factura): Promise<SelloMH> {
    console.log(`[MH Mock] Transmitiendo DTE ${factura.codigoGeneracion}`);
    
    // Simular delay de red (1-3 segundos)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Simular 95% éxito, 5% rechazo
    const exito = Math.random() > 0.05;
    
    const sello: SelloMH = {
      codigoGeneracion: factura.codigoGeneracion,
      selloRecibido: exito 
        ? `SELLO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        : "",
      fechaSello: new Date().toISOString(),
      estado: exito ? "PROCESADO" : "RECHAZADO",
      observaciones: exito 
        ? "DTE procesado exitosamente (MODO SIMULACIÓN)"
        : "Rechazo simulado para pruebas"
    };
    
    if (exito) {
      this.procesados.set(factura.codigoGeneracion, sello);
    }
    
    console.log(`[MH Mock] Resultado:`, sello.estado);
    return sello;
  }
  
  async consultarEstado(codigoGeneracion: string): Promise<EstadoDTE> {
    console.log(`[MH Mock] Consultando estado de ${codigoGeneracion}`);
    
    // Simular delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const sello = this.procesados.get(codigoGeneracion);
    
    if (sello) {
      return {
        estado: "ACEPTADO",
        mensaje: "DTE aceptado por el MH (SIMULACIÓN)",
        fechaConsulta: new Date().toISOString()
      };
    }
    
    return {
      estado: "NO_ENCONTRADO",
      mensaje: "DTE no encontrado en registros del MH (SIMULACIÓN)",
      fechaConsulta: new Date().toISOString()
    };
  }
  
  async anularDTE(codigoGeneracion: string, motivo: string): Promise<ResultadoAnulacion> {
    console.log(`[MH Mock] Anulando DTE ${codigoGeneracion}. Motivo: ${motivo}`);
    
    // Simular delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    this.procesados.delete(codigoGeneracion);
    
    return {
      success: true,
      mensaje: "DTE anulado exitosamente (SIMULACIÓN)",
      fechaAnulacion: new Date().toISOString()
    };
  }
  
  async verificarConexion(): Promise<boolean> {
    console.log(`[MH Mock] Verificando conexión...`);
    await new Promise(resolve => setTimeout(resolve, 300));
    return true; // Mock siempre está "conectado"
  }
}

// ============================================
// IMPLEMENTACIÓN REAL (para producción con certificado)
// ============================================
export class MHServiceReal implements MHService {
  private apiUrl: string;
  private token: string | undefined;
  
  constructor() {
    this.apiUrl = process.env.MH_API_URL || "https://api.mh.gob.sv";
    this.token = process.env.MH_API_TOKEN;
  }
  
  async transmitirDTE(factura: Factura): Promise<SelloMH> {
    // TODO: Implementar cuando se tenga certificado digital
    // Pasos:
    // 1. Validar que existe certificado
    // 2. Firmar digitalmente el DTE
    // 3. Enviar a API del MH
    // 4. Procesar respuesta
    
    if (!this.token) {
      throw new Error(
        "Certificado digital no configurado. " +
        "Configure MH_API_TOKEN en variables de entorno o active modo mock."
      );
    }
    
    try {
      // Aquí iría la implementación real con firma digital
      const response = await fetch(`${this.apiUrl}/recepcion-dte`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(factura)
      });
      
      if (!response.ok) {
        throw new Error(`Error del MH: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("[MH Real] Error al transmitir:", error);
      throw new Error(`No se pudo transmitir al MH: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
  
  async consultarEstado(codigoGeneracion: string): Promise<EstadoDTE> {
    if (!this.token) {
      throw new Error("Certificado digital no configurado");
    }
    
    try {
      const response = await fetch(
        `${this.apiUrl}/consulta-dte/${codigoGeneracion}`,
        {
          headers: {
            "Authorization": `Bearer ${this.token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Error del MH: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("[MH Real] Error al consultar:", error);
      throw new Error(`No se pudo consultar estado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
  
  async anularDTE(codigoGeneracion: string, motivo: string): Promise<ResultadoAnulacion> {
    if (!this.token) {
      throw new Error("Certificado digital no configurado");
    }
    
    try {
      const response = await fetch(`${this.apiUrl}/anular-dte`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ codigoGeneracion, motivo })
      });
      
      if (!response.ok) {
        throw new Error(`Error del MH: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("[MH Real] Error al anular:", error);
      throw new Error(`No se pudo anular: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
  
  async verificarConexion(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: "GET",
        headers: this.token ? { "Authorization": `Bearer ${this.token}` } : {}
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================
// FACTORY: Selecciona implementación según configuración
// ============================================
export function createMHService(): MHService {
  const mockMode = process.env.MH_MOCK_MODE === "true" || !process.env.MH_API_TOKEN;
  
  if (mockMode) {
    console.log("🔧 [MH Service] Usando MOCK (simulación) - No se transmitirá al MH real");
    return new MHServiceMock();
  } else {
    console.log("🔐 [MH Service] Usando implementación REAL con certificado");
    return new MHServiceReal();
  }
}

// Instancia global del servicio
export const mhService = createMHService();
