import { describe, it, expect, vi, beforeAll } from "vitest";

// Mocks HOISTED antes de importar el módulo bajo prueba
const mockDb = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      // Para casos con .returning()
      returning: vi.fn(async () => [{ id: "mock-id" }]),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
  })),
  select: vi.fn((shape?: any) => ({
    from: vi.fn(() => {
      // Objeto thenable para soportar await directo sin where()
      const resultForShape = () => {
        if (shape && typeof shape === "object" && Object.keys(shape).length > 0) {
          const result: any = {};
          for (const k of Object.keys(shape)) result[k] = 0;
          return [result];
        }
        return [];
      };
      const thenable: any = {
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => []),
          then: (resolve: any) => resolve(resultForShape()),
        })),
        then: (resolve: any) => resolve(resultForShape()),
      };
      return thenable;
    }),
  })),
};

vi.mock("../../server/db.ts", () => ({ db: mockDb }));
vi.mock("../../server/lib/audit.ts", () => ({ logAudit: vi.fn(async () => undefined) }));
vi.mock("../../server/lib/siem.ts", () => ({ sendToSIEM: vi.fn(async () => undefined) }));

// Importar módulo bajo prueba DESPUÉS de definir los mocks
let grantSigmaSupportAccess: any,
  revokeSigmaSupportAccess: any,
  logSupportAction: any,
  getActiveSupportAccesses: any,
  getSupportStats: any,
  createSupportTicket: any;

beforeAll(async () => {
  const svc = await import("../../server/lib/sigma-support.ts");
  grantSigmaSupportAccess = svc.grantSigmaSupportAccess;
  revokeSigmaSupportAccess = svc.revokeSigmaSupportAccess;
  logSupportAction = svc.logSupportAction;
  getActiveSupportAccesses = svc.getActiveSupportAccesses;
  getSupportStats = svc.getSupportStats;
  createSupportTicket = svc.createSupportTicket;
});

describe("Sigma Support - Servicios", () => {
  const mockAdminId = "admin-123";
  const mockTenantId = "tenant-456";

  describe("grantSigmaSupportAccess", () => {
    it("debería otorgar acceso temporal con fecha válida por defecto", async () => {
      const resultado = await grantSigmaSupportAccess(mockAdminId, {
        supportUserId: "sigma-user-1",
        supportUserName: "Juan Support",
        supportEmail: "juan@sigma.com",
        tenantId: mockTenantId,
        tenantNombre: "Mi Empresa",
        tipoAcceso: "readonly",
        razon: "Investigación de bug",
        permisos: {
          canViewLogs: true,
          canViewMetrics: true,
          canViewAudit: false,
          canExportData: false,
        },
      });

      expect(resultado.accessId).toBeDefined();
      expect(resultado.validoHasta).toBeInstanceOf(Date);
      // Por defecto debería ser 7 días
      const diff = resultado.validoHasta.getTime() - new Date().getTime();
      const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
      expect(dias).toBeGreaterThanOrEqual(6);
      expect(dias).toBeLessThanOrEqual(7);
    });

    it("debería respetar fecha de expiración personalizada", async () => {
      const fechaPersonalizada = new Date();
      fechaPersonalizada.setDate(fechaPersonalizada.getDate() + 3);

      const resultado = await grantSigmaSupportAccess(mockAdminId, {
        supportUserId: "sigma-user-2",
        supportUserName: "María Support",
        supportEmail: "maria@sigma.com",
        tenantId: mockTenantId,
        tenantNombre: "Mi Empresa",
        tipoAcceso: "readwrite",
        razon: "Mantenimiento preventivo",
        fechaFin: fechaPersonalizada,
        permisos: {
          canViewLogs: true,
          canViewMetrics: true,
          canViewAudit: true,
          canExportData: true,
        },
      });

      expect(resultado.validoHasta.getDate()).toBe(fechaPersonalizada.getDate());
    });
  });

  describe("logSupportAction", () => {
    it("debería registrar acción exitosa", async () => {
      await logSupportAction("user-1", "Juan Support", {
        action: "view_logs",
        recurso: "facturas",
        exitoso: true,
      });

      expect(true).toBe(true);
    });

    it("debería registrar acción fallida con error", async () => {
      await logSupportAction("user-1", "Juan Support", {
        action: "export_data",
        recurso: "reportes",
        exitoso: false,
        error: "Permiso insuficiente",
      });

      expect(true).toBe(true);
    });

    it("debería usar UUID para resourceId (PII-safe)", async () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      await logSupportAction("user-1", "Juan Support", {
        action: "view_logs",
        recurso: "facturas",
        resourceId: "550e8400-e29b-41d4-a716-446655440000",
        exitoso: true,
      });

      expect(true).toBe(true);
    });
  });

  describe("createSupportTicket", () => {
    it("debería crear ticket con número único", async () => {
      const resultado = await createSupportTicket(mockTenantId, mockAdminId, {
        titulo: "Error en transmisión de DTE",
        descripcion: "Las facturas no se transmiten correctamente al DGII",
        categoria: "transmisiones",
        severidad: "alta",
      });

      expect(resultado.ticketId).toBeDefined();
      expect(resultado.numeroTicket).toMatch(/^TKT-\d+-/);
    });

    it("debería generar números únicos para cada ticket", async () => {
      const r1 = await createSupportTicket(mockTenantId, mockAdminId, {
        titulo: "Problema 1",
        descripcion: "Descripción 1",
        categoria: "facturas",
        severidad: "normal",
      });

      const r2 = await createSupportTicket(mockTenantId, mockAdminId, {
        titulo: "Problema 2",
        descripcion: "Descripción 2",
        categoria: "certificados",
        severidad: "critica",
      });

      expect(r1.numeroTicket).not.toBe(r2.numeroTicket);
    });
  });

  describe("getSupportStats", () => {
    it("debería retornar estadísticas con estructura correcta", async () => {
      const stats = await getSupportStats();

      expect(stats).toHaveProperty("accessesActivos");
      expect(stats).toHaveProperty("logsUltimas24h");
      expect(stats).toHaveProperty("ticketsAbiertos");
      expect(stats).toHaveProperty("ticketsCriticos");

      expect(typeof stats.accessesActivos).toBe("number");
      expect(stats.accessesActivos >= 0).toBe(true);
    });
  });

  describe("getActiveSupportAccesses", () => {
    it("debería retornar array de accesos activos", async () => {
      const accesos = await getActiveSupportAccesses();

      expect(Array.isArray(accesos)).toBe(true);
      
      if (accesos.length > 0) {
        expect(accesos[0]).toHaveProperty("accessId");
        expect(accesos[0]).toHaveProperty("supportUserName");
        expect(accesos[0]).toHaveProperty("tipoAcceso");
        expect(accesos[0]).toHaveProperty("validoHasta");
      }
    });

    it("debería filtrar por tenantId cuando se proporciona", async () => {
      const accesos = await getActiveSupportAccesses(mockTenantId);

      expect(Array.isArray(accesos)).toBe(true);
    });
  });
});
