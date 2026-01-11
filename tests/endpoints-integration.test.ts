import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { createServer } from "http";

// Mock de storage
const mockStorage = {
  facturas: new Map<string, any>(),
  contingencia: [] as any[],
  anulaciones: [] as any[],
  
  async getFactura(id: string, tenantId: string) {
    const f = this.facturas.get(id);
    return f?.tenantId === tenantId ? f : undefined;
  },
  
  async addToContingenciaQueue(tenantId: string, facturaId: string, codigoGeneracion: string) {
    this.contingencia.push({ 
      tenantId, 
      facturaId, 
      codigoGeneracion, 
      estado: "pendiente", 
      intentosFallidos: 0 
    });
  },
  
  async getContingenciaQueue(tenantId: string, estado?: string) {
    return this.contingencia.filter(c => 
      c.tenantId === tenantId && (!estado || c.estado === estado)
    );
  },
  
  async updateContingenciaStatus(codigoGeneracion: string, estado: string, error?: string) {
    const item = this.contingencia.find(c => c.codigoGeneracion === codigoGeneracion);
    if (item) {
      item.estado = estado;
      if (error) {
        item.ultimoError = error;
        item.intentosFallidos = (item.intentosFallidos ?? 0) + 1;
      }
    }
  },
  
  async marcarContingenciaCompleta(codigoGeneracion: string) {
    const item = this.contingencia.find(c => c.codigoGeneracion === codigoGeneracion);
    if (item) {
      item.estado = "completado";
    }
  },
  
  async crearAnulacion(tenantId: string, facturaId: string, codigoGeneracion: string, motivo: string, usuarioId: string, observaciones?: string) {
    this.anulaciones.push({
      tenantId,
      facturaId,
      codigoGeneracion,
      motivo,
      usuarioAnulo: usuarioId,
      observaciones,
      estado: "pendiente",
      intentosFallidos: 0,
    });
  },
  
  async getAnulacion(codigoGeneracion: string, tenantId: string) {
    return this.anulaciones.find(a => 
      a.codigoGeneracion === codigoGeneracion && a.tenantId === tenantId
    ) || null;
  },
  
  async getAnulacionesPendientes(tenantId: string) {
    return this.anulaciones.filter(a => 
      a.tenantId === tenantId && a.estado === "pendiente"
    );
  },
  
  async updateAnulacionStatus(codigoGeneracion: string, estado: string, selloAnulacion?: string, respuestaMH?: any, error?: string) {
    const item = this.anulaciones.find(a => a.codigoGeneracion === codigoGeneracion);
    if (item) {
      item.estado = estado;
      if (selloAnulacion) item.selloAnulacion = selloAnulacion;
      if (respuestaMH) item.respuestaMH = respuestaMH;
      if (error) {
        item.ultimoError = error;
        item.intentosFallidos = (item.intentosFallidos ?? 0) + 1;
      }
    }
  },
  
  async updateFactura(id: string, tenantId: string, updates: any) {
    const f = this.facturas.get(id);
    if (f?.tenantId === tenantId) {
      Object.assign(f, updates);
      return f;
    }
    return undefined;
  },
  
  async getHistoricoAnulaciones(tenantId: string) {
    return this.anulaciones.filter(a => a.tenantId === tenantId);
  },
  
  reset() {
    this.facturas.clear();
    this.contingencia.length = 0;
    this.anulaciones.length = 0;
  }
};

// Mock de MHService
const mockMHService = {
  async verificarDisponibilidad() {
    return this.disponible;
  },
  
  async transmitirDTE(factura: any) {
    if (!this.disponible) throw new Error("MH no disponible");
    return {
      codigoGeneracion: factura.codigoGeneracion,
      selloRecibido: "SELLO-OK",
      estado: "PROCESADO",
    };
  },
  
  async invalidarDTE(codigoGeneracion: string) {
    if (!this.disponible) throw new Error("MH no disponible");
    return {
      success: true,
      mensaje: "Invalidado",
      selloAnulacion: "ANU-OK",
      fechaAnulo: new Date().toISOString(),
    };
  },
  
  async procesarColaContingencia() {},
  async procesarAnulacionesPendientes() {},
  
  disponible: true,
};

// Mocks
vi.mock("../server/storage", () => ({ storage: mockStorage }));
vi.mock("../server/mh-service", () => ({ mhService: mockMHService }));

// Mock de requireAuth middleware
const mockAuthMiddleware = (req: any, _res: any, next: any) => {
  req.user = { tenantId: "tenant-test", id: "user-test" };
  next();
};

vi.mock("../server/auth", () => ({
  requireAuth: mockAuthMiddleware,
  requireTenantAdmin: [mockAuthMiddleware],
  requireManager: [mockAuthMiddleware],
  requireApiKey: mockAuthMiddleware,
  registerAuthRoutes: () => {},
}));

vi.mock("../server/routes/admin", () => ({
  registerAdminRoutes: () => {},
}));

describe("Endpoints de Contingencia e Invalidación", () => {
  let app: Express;
  let server: any;

  beforeEach(async () => {
    mockStorage.reset();
    mockMHService.disponible = true;
    
    app = express();
    app.use(express.json());
    server = createServer(app);
    
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(server, app);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/facturas/:id/transmitir", () => {
    it("transmite factura cuando MH está disponible", async () => {
      mockStorage.facturas.set("f1", {
        id: "f1",
        tenantId: "tenant-test",
        codigoGeneracion: "CG-1",
        estado: "generada",
      });

      const res = await request(app)
        .post("/api/facturas/f1/transmitir")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.sello.estado).toBe("PROCESADO");
    });

    it("agrega a cola de contingencia cuando MH no disponible", async () => {
      mockMHService.disponible = false;
      mockStorage.facturas.set("f2", {
        id: "f2",
        tenantId: "tenant-test",
        codigoGeneracion: "CG-2",
        estado: "generada",
      });

      const res = await request(app)
        .post("/api/facturas/f2/transmitir")
        .expect(202);

      expect(res.body.estado).toBe("pendiente_contingencia");
      expect(mockStorage.contingencia).toHaveLength(1);
      expect(mockStorage.contingencia[0].codigoGeneracion).toBe("CG-2");
    });

    it("rechaza transmitir factura ya transmitida", async () => {
      mockStorage.facturas.set("f3", {
        id: "f3",
        tenantId: "tenant-test",
        codigoGeneracion: "CG-3",
        estado: "sellada",
      });

      const res = await request(app)
        .post("/api/facturas/f3/transmitir")
        .expect(400);

      expect(res.body.error).toContain("ya fue transmitida");
    });
  });

  describe("POST /api/facturas/:id/invalidar", () => {
    it("invalida factura con motivo válido", async () => {
      mockStorage.facturas.set("f4", {
        id: "f4",
        tenantId: "tenant-test",
        codigoGeneracion: "CG-4",
        estado: "sellada",
      });

      const res = await request(app)
        .post("/api/facturas/f4/invalidar")
        .send({ motivo: "01", observaciones: "Error en monto" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.estado).toBe("aceptado");
      expect(mockStorage.anulaciones).toHaveLength(1);
    });

    it("rechaza motivo inválido", async () => {
      mockStorage.facturas.set("f5", {
        id: "f5",
        tenantId: "tenant-test",
        codigoGeneracion: "CG-5",
        estado: "sellada",
      });

      const res = await request(app)
        .post("/api/facturas/f5/invalidar")
        .send({ motivo: "99" })
        .expect(400);

      expect(res.body.error).toContain("Motivo inválido");
    });

    it("agrega a cola cuando MH no disponible", async () => {
      mockMHService.disponible = false;
      mockStorage.facturas.set("f6", {
        id: "f6",
        tenantId: "tenant-test",
        codigoGeneracion: "CG-6",
        estado: "sellada",
      });

      const res = await request(app)
        .post("/api/facturas/f6/invalidar")
        .send({ motivo: "02" })
        .expect(202);

      expect(res.body.estado).toBe("pendiente");
      expect(mockStorage.anulaciones).toHaveLength(1);
    });
  });

  describe("GET /api/contingencia/estado", () => {
    it("retorna estado de la cola de contingencia", async () => {
      mockStorage.contingencia.push(
        { tenantId: "tenant-test", estado: "pendiente", codigoGeneracion: "C1" },
        { tenantId: "tenant-test", estado: "completado", codigoGeneracion: "C2" },
        { tenantId: "tenant-test", estado: "error", codigoGeneracion: "C3" }
      );

      const res = await request(app)
        .get("/api/contingencia/estado")
        .expect(200);

      expect(res.body.pendientes).toBe(1);
      expect(res.body.completadas).toBe(1);
      expect(res.body.errores).toBe(1);
    });
  });

  describe("GET /api/anulaciones/pendientes", () => {
    it("lista anulaciones pendientes del tenant", async () => {
      mockStorage.anulaciones.push(
        { tenantId: "tenant-test", estado: "pendiente", codigoGeneracion: "A1" },
        { tenantId: "tenant-test", estado: "aceptado", codigoGeneracion: "A2" },
        { tenantId: "otro-tenant", estado: "pendiente", codigoGeneracion: "A3" }
      );

      const res = await request(app)
        .get("/api/anulaciones/pendientes")
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.anulaciones[0].codigoGeneracion).toBe("A1");
    });
  });

  describe("GET /api/anulaciones/historico", () => {
    it("retorna histórico de anulaciones", async () => {
      mockStorage.anulaciones.push(
        { tenantId: "tenant-test", estado: "aceptado", codigoGeneracion: "H1" },
        { tenantId: "tenant-test", estado: "error", codigoGeneracion: "H2" }
      );

      const res = await request(app)
        .get("/api/anulaciones/historico")
        .expect(200);

      expect(res.body.total).toBe(2);
    });
  });

  describe("POST /api/contingencia/procesar", () => {
    it("procesa la cola de contingencia", async () => {
      const res = await request(app)
        .post("/api/contingencia/procesar")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.mensaje).toContain("procesada");
    });
  });

  describe("POST /api/anulaciones/procesar", () => {
    it("procesa anulaciones pendientes", async () => {
      const res = await request(app)
        .post("/api/anulaciones/procesar")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.mensaje).toContain("procesadas");
    });
  });
});
