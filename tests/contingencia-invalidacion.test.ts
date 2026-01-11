import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de storage para controlar el estado sin BD real
function createMockStorage() {
  const state = {
    facturas: new Map<string, any>(),
    contingencia: [] as any[],
    anulaciones: [] as any[],
  };

  return {
    state,
    reset() {
      state.facturas.clear();
      state.contingencia.length = 0;
      state.anulaciones.length = 0;
    },
    async getFactura(id: string, tenantId: string) {
      const f = state.facturas.get(id);
      return f && f.tenantId === tenantId ? f : undefined;
    },
    async addToContingenciaQueue(tenantId: string, facturaId: string, codigoGeneracion: string) {
      state.contingencia.push({ tenantId, facturaId, codigoGeneracion, estado: "pendiente", intentosFallidos: 0 });
    },
    async getContingenciaQueue(tenantId: string, estado?: string) {
      return state.contingencia.filter((c) => c.tenantId === tenantId && (!estado || c.estado === estado));
    },
    async updateContingenciaStatus(codigoGeneracion: string, estado: string, error?: string) {
      const item = state.contingencia.find((c) => c.codigoGeneracion === codigoGeneracion);
      if (!item) return;
      item.estado = estado;
      if (error) {
        item.ultimoError = error;
        item.intentosFallidos = (item.intentosFallidos ?? 0) + 1;
      }
    },
    async marcarContingenciaCompleta(codigoGeneracion: string) {
      const item = state.contingencia.find((c) => c.codigoGeneracion === codigoGeneracion);
      if (item) {
        item.estado = "completado";
        item.fechaCompletado = new Date().toISOString();
      }
    },
    async crearAnulacion(tenantId: string, facturaId: string, codigoGeneracion: string, motivo: string, usuarioId: string, observaciones?: string) {
      state.anulaciones.push({
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
      return (
        state.anulaciones.find((a) => a.codigoGeneracion === codigoGeneracion && a.tenantId === tenantId) || null
      );
    },
    async getAnulacionesPendientes(tenantId: string) {
      return state.anulaciones.filter((a) => a.tenantId === tenantId && a.estado === "pendiente");
    },
    async updateAnulacionStatus(
      codigoGeneracion: string,
      estado: string,
      selloAnulacion?: string,
      respuestaMH?: any,
      error?: string
    ) {
      const item = state.anulaciones.find((a) => a.codigoGeneracion === codigoGeneracion);
      if (!item) return;
      item.estado = estado;
      if (selloAnulacion) item.selloAnulacion = selloAnulacion;
      if (respuestaMH) item.respuestaMH = respuestaMH;
      if (error) {
        item.ultimoError = error;
        item.intentosFallidos = (item.intentosFallidos ?? 0) + 1;
      }
      item.fechaProcesso = new Date().toISOString();
    },
    async getHistoricoAnulaciones(tenantId: string) {
      return state.anulaciones.filter((a) => a.tenantId === tenantId);
    },
  };
}

const mockStorage = createMockStorage();

vi.mock("../server/storage", () => ({
  storage: mockStorage,
}));

describe("Procesamiento de contingencia e invalidación", () => {
  let MHServiceReal: any;

  beforeEach(async () => {
    mockStorage.reset();
    vi.clearAllMocks();
    ({ MHServiceReal } = await import("../server/mh-service"));
  });

  it("procesa la cola de contingencia y marca como completado cuando MH responde", async () => {
    mockStorage.state.facturas.set("f1", { id: "f1", tenantId: "t1", codigoGeneracion: "CG-1" });
    mockStorage.state.contingencia.push({
      tenantId: "t1",
      facturaId: "f1",
      codigoGeneracion: "CG-1",
      estado: "pendiente",
      intentosFallidos: 0,
    });

    const service = new MHServiceReal();
    service.transmitirDTE = vi.fn().mockResolvedValue({
      codigoGeneracion: "CG-1",
      selloRecibido: "SELLO-OK",
      fechaSello: new Date().toISOString(),
      estado: "PROCESADO",
      observaciones: "Aceptado",
    });

    await service.procesarColaContingencia("t1");

    const registro = mockStorage.state.contingencia[0];
    expect(registro.estado).toBe("completado");
    expect(registro.intentosFallidos).toBe(0);
  });

  it("marca la contingencia como error tras más de 10 intentos fallidos", async () => {
    mockStorage.state.facturas.set("f1", { id: "f1", tenantId: "t1", codigoGeneracion: "CG-FAIL" });
    mockStorage.state.contingencia.push({
      tenantId: "t1",
      facturaId: "f1",
      codigoGeneracion: "CG-FAIL",
      estado: "pendiente",
      intentosFallidos: 10,
    });

    const service = new MHServiceReal();
    service.transmitirDTE = vi.fn().mockRejectedValue(new Error("Falla de red"));

    await service.procesarColaContingencia("t1");

    const registro = mockStorage.state.contingencia[0];
    expect(registro.estado).toBe("error");
    expect(registro.intentosFallidos).toBeGreaterThan(10);
    expect(registro.ultimoError).toBe("Falla de red");
  });

  it("procesa anulaciones pendientes y marca como aceptado cuando MH responde", async () => {
    mockStorage.state.anulaciones.push({
      tenantId: "t1",
      facturaId: "f2",
      codigoGeneracion: "CG-ANU",
      motivo: "01",
      estado: "pendiente",
      intentosFallidos: 0,
    });

    const service = new MHServiceReal();
    service.invalidarDTE = vi.fn().mockResolvedValue({
      success: true,
      mensaje: "OK",
      selloAnulacion: "ANU-1",
      fechaAnulo: new Date().toISOString(),
    });

    await service.procesarAnulacionesPendientes("t1");

    const registro = mockStorage.state.anulaciones[0];
    expect(registro.estado).toBe("aceptado");
    expect(registro.selloAnulacion).toBe("ANU-1");
  });

  it("marca anulación como error tras superar 10 intentos fallidos", async () => {
    mockStorage.state.anulaciones.push({
      tenantId: "t1",
      facturaId: "f3",
      codigoGeneracion: "CG-ANU-FAIL",
      motivo: "02",
      estado: "pendiente",
      intentosFallidos: 10,
    });

    const service = new MHServiceReal();
    service.invalidarDTE = vi.fn().mockRejectedValue(new Error("MH caído"));

    await service.procesarAnulacionesPendientes("t1");

    const registro = mockStorage.state.anulaciones[0];
    expect(registro.estado).toBe("error");
    expect(registro.intentosFallidos).toBeGreaterThan(10);
    expect(registro.ultimoError).toBe("MH caído");
  });
});
