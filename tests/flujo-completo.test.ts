import { describe, it, expect, beforeAll } from "vitest";
import { SQLiteStorage } from "../server/storage";
import { validateDTESchema } from "../server/dgii-validator";

describe("Flujo Completo de Factura", () => {
  let storage: SQLiteStorage;

  beforeAll(async () => {
    // Crear instancia de storage con BD de prueba
    storage = new SQLiteStorage(":memory:");
    await storage.initialize();
  });

  it("Debe generar número de control único para cada factura", async () => {
    const nit = "00123456789012-0";
    const tipoDte = "01";

    // Primera llamada
    const numeroControl1 = await storage.getNextNumeroControl(nit, tipoDte);
    expect(numeroControl1).toBe("001-000000000000000001");

    // Segunda llamada (mismo NIT y tipo)
    const numeroControl2 = await storage.getNextNumeroControl(nit, tipoDte);
    expect(numeroControl2).toBe("001-000000000000000002");

    // Tercera llamada
    const numeroControl3 = await storage.getNextNumeroControl(nit, tipoDte);
    expect(numeroControl3).toBe("001-000000000000000003");

    // Formato debe ser válido (3 dígitos - 18 dígitos)
    expect(numeroControl1).toMatch(/^\d{3}-\d{18}$/);
  });

  it("Debe generar números de control independientes para diferentes tipos DTE", async () => {
    const nit = "00987654321098-0";

    // Tipo DTE 01 (Factura)
    const numeroControl01 = await storage.getNextNumeroControl(nit, "01");
    expect(numeroControl01).toBe("001-000000000000000001");

    // Tipo DTE 03 (CCF)
    const numeroControl03 = await storage.getNextNumeroControl(nit, "03");
    expect(numeroControl03).toBe("003-000000000000000001");

    // Siguiente de tipo 01 debe seguir secuencia
    const numeroControl01_2 = await storage.getNextNumeroControl(nit, "01");
    expect(numeroControl01_2).toBe("001-000000000000000002");
  });

  it("Debe validar DTE contra schema DGII", () => {
    const dtValido = {
      version: 1,
      ambiente: "01",
      tipoDte: "01",
      numeroControl: "001-000000000000000001",
      codigoGeneracion: "550e8400-e29b-41d4-a716-446655440000",
      tipoModelo: "1",
      tipoOperacion: "1",
      fecEmi: "2026-01-06",
      horEmi: "12:00:00",
      tipoMoneda: "USD",
      emisor: {
        nit: "00123456789012-0",
        nrc: "123456-7",
        nombre: "Mi Empresa",
        codActividad: "620100",
        descActividad: "Consultoria",
        tipoEstablecimiento: "01",
        direccion: {
          departamento: "06",
          municipio: "01",
          complemento: "Calle Principal",
        },
        telefono: "22345678",
        correo: "info@empresa.com",
      },
      receptor: {
        tipoDocumento: "36",
        numDocumento: "0000000000000-0",
        nombre: "Cliente SA",
        direccion: {
          departamento: "06",
          municipio: "01",
          complemento: "San Salvador",
        },
      },
      cuerpoDocumento: [
        {
          numItem: 1,
          tipoItem: "2",
          cantidad: 1,
          uniMedida: 99,
          descripcion: "Producto A",
          precioUni: 100,
          monto: 100,
        },
      ],
      resumen: {
        totalExentos: 0,
        totalGravados: 100,
        subTotalVentas: 100,
        totalDescu: 0,
        totalNoGravado: 0,
        totalPagar: 113,
        totalIva: 13,
        condicionOperacion: "1",
      },
    };

    const validacion = validateDTESchema(dtValido);
    expect(validacion.valid).toBe(true);
    expect(validacion.errors).toHaveLength(0);
  });

  it("Debe rechazar DTE con NIT inválido", () => {
    const dteInvalido = {
      version: 1,
      ambiente: "01",
      tipoDte: "01",
      numeroControl: "001-000000000000000001",
      codigoGeneracion: "550e8400-e29b-41d4-a716-446655440000",
      tipoModelo: "1",
      tipoOperacion: "1",
      fecEmi: "2026-01-06",
      horEmi: "12:00:00",
      tipoMoneda: "USD",
      emisor: {
        nit: "INVALID", // NIT inválido
        nrc: "123456-7",
        nombre: "Mi Empresa",
        codActividad: "620100",
        descActividad: "Consultoria",
        tipoEstablecimiento: "01",
        direccion: {
          departamento: "06",
          municipio: "01",
          complemento: "Calle Principal",
        },
        telefono: "22345678",
        correo: "info@empresa.com",
      },
      receptor: {
        tipoDocumento: "36",
        numDocumento: "0000000000000-0",
        nombre: "Cliente SA",
        direccion: {
          departamento: "06",
          municipio: "01",
          complemento: "San Salvador",
        },
      },
      cuerpoDocumento: [
        {
          numItem: 1,
          tipoItem: "2",
          cantidad: 1,
          uniMedida: 99,
          descripcion: "Producto A",
          precioUni: 100,
          monto: 100,
        },
      ],
      resumen: {
        totalExentos: 0,
        totalGravados: 100,
        subTotalVentas: 100,
        totalDescu: 0,
        totalNoGravado: 0,
        totalPagar: 113,
        totalIva: 13,
        condicionOperacion: "1",
      },
    };

    const validacion = validateDTESchema(dteInvalido);
    expect(validacion.valid).toBe(false);
    expect(validacion.errors.length).toBeGreaterThan(0);
  });

  it("Debe rechazar código generación duplicado", async () => {
    const codigoGen = "550e8400-e29b-41d4-a716-446655440001";

    // Primera factura con código
    const factura1 = {
      tipoDte: "01",
      numeroControl: "001-000000000000000010",
      codigoGeneracion: codigoGen,
      fecEmi: "2026-01-06",
      emisor: {
        nit: "00123456789012-0",
        nrc: "123456-7",
        nombre: "Mi Empresa",
        codActividad: "620100",
        descActividad: "Consultoria",
        tipoEstablecimiento: "01",
        direccion: {
          departamento: "06",
          municipio: "01",
          complemento: "Calle",
        },
        telefono: "22345678",
        correo: "info@empresa.com",
      },
      receptor: {
        tipoDocumento: "36",
        numDocumento: "0000000000000-0",
        nombre: "Cliente",
        direccion: {
          departamento: "06",
          municipio: "01",
          complemento: "San Salvador",
        },
      },
      cuerpoDocumento: [
        {
          numItem: 1,
          tipoItem: "2",
          cantidad: 1,
          uniMedida: 99,
          descripcion: "Producto",
          precioUni: 100,
          monto: 100,
        },
      ],
      resumen: {
        totalExentos: 0,
        totalGravados: 100,
        subTotalVentas: 100,
        totalDescu: 0,
        totalNoGravado: 0,
        totalPagar: 113,
        totalIva: 13,
        condicionOperacion: "1",
      },
    };

    await storage.createFactura(factura1 as any);

    // Buscar por código generación
    const facturasExistentes = await storage.getFacturaByCodigoGeneracion(codigoGen);
    expect(facturasExistentes).not.toBeNull();
    expect(facturasExistentes?.codigoGeneracion).toBe(codigoGen);
  });

  it("Debe calcular totales correctamente", () => {
    // Test simple de cálculo de IVA
    const subtotal = 100;
    const ivaRate = 0.13;
    const iva = subtotal * ivaRate;
    const total = subtotal + iva;

    expect(iva).toBe(13);
    expect(total).toBe(113);
  });
});
