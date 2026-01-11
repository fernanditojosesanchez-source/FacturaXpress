import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { emisorSchema, insertFacturaSchema } from "@shared/schema";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { mhService } from "./mh-service";
import { generarFacturasPrueba, EMISOR_PRUEBA } from "./seed-data";
import { 
  registerAuthRoutes, 
  requireAuth, 
  requireTenantAdmin, 
  requireManager 
} from "./auth";
import {
  DEPARTAMENTOS_EL_SALVADOR,
  TIPOS_DOCUMENTO,
  TIPOS_DTE,
  CONDICIONES_OPERACION,
  FORMAS_PAGO,
  TIPOS_ITEM,
  UNIDADES_MEDIDA,
} from "./catalogs";
import { validateDTESchema } from "./dgii-validator";
import { registerAdminRoutes } from "./routes/admin";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Rutas de autenticación
  registerAuthRoutes(app);
  registerAdminRoutes(app);

  // Helper para obtener tenantId del request
  const getTenantId = (req: Request) => (req as any).user?.tenantId;

  // ============================================
  // ENDPOINTS DE CATÁLOGOS DGII (Públicos/Globales)
  // ============================================

  app.get("/api/catalogos/departamentos", (_req: Request, res: Response) => {
    res.json(DEPARTAMENTOS_EL_SALVADOR);
  });

  app.get("/api/catalogos/tipos-documento", (_req: Request, res: Response) => {
    res.json(TIPOS_DOCUMENTO);
  });

  app.get("/api/catalogos/tipos-dte", (_req: Request, res: Response) => {
    res.json(TIPOS_DTE);
  });

  app.get("/api/catalogos/condiciones-operacion", (_req: Request, res: Response) => {
    res.json(CONDICIONES_OPERACION);
  });

  app.get("/api/catalogos/formas-pago", (_req: Request, res: Response) => {
    res.json(FORMAS_PAGO);
  });

  app.get("/api/catalogos/tipos-item", (_req: Request, res: Response) => {
    res.json(TIPOS_ITEM);
  });

  app.get("/api/catalogos/unidades-medida", (_req: Request, res: Response) => {
    res.json(UNIDADES_MEDIDA);
  });

  app.get("/api/catalogos/all", (_req: Request, res: Response) => {
    res.json({
      departamentos: DEPARTAMENTOS_EL_SALVADOR,
      tiposDocumento: TIPOS_DOCUMENTO,
      tiposDte: TIPOS_DTE,
      condicionesOperacion: CONDICIONES_OPERACION,
      formasPago: FORMAS_PAGO,
      tiposItem: TIPOS_ITEM,
      unidadesMedida: UNIDADES_MEDIDA,
    });
  });

  // ============================================
  // ENDPOINTS DE CLIENTES (RECEPTORES)
  // ============================================

  app.get("/api/receptores", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const receptores = await storage.getReceptores(tenantId);
      res.json(receptores);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener clientes" });
    }
  });

  app.get("/api/receptores/:doc", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const receptor = await storage.getReceptorByDoc(tenantId, req.params.doc);
      if (!receptor) return res.status(404).json({ error: "Cliente no encontrado" });
      res.json(receptor);
    } catch (error) {
      res.status(500).json({ error: "Error al buscar cliente" });
    }
  });

  // ============================================
  // VALIDACIÓN DTE CONTRA SCHEMA DGII
  // ============================================
  app.post("/api/validar-dte", requireAuth, (req: Request, res: Response) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          valid: false,
          errors: [{ field: "root", message: "Request body must be a JSON object" }]
        });
      }

      const dteValidation = validateDTESchema(req.body);
      
      if (dteValidation.valid) {
        return res.json({ 
          valid: true, 
          message: "DTE válido según schema DGII" 
        });
      } else {
        return res.status(400).json({
          valid: false,
          errors: dteValidation.errors
        });
      }
    } catch (error) {
      console.error("[validar-dte] Error:", error);
      return res.status(500).json({ 
        error: "Error al validar DTE",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // ============================================
  // ENDPOINTS DE EMISOR (Configuración por Tenant)
  // ============================================

  app.get("/api/emisor", ...requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const emisor = await storage.getEmisor(tenantId);
      if (!emisor) {
        return res.json({});
      }
      res.json(emisor);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener datos del emisor" });
    }
  });

  app.post("/api/emisor", ...requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = emisorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const emisor = await storage.saveEmisor(tenantId, parsed.data);
      res.json(emisor);
    } catch (error) {
      res.status(500).json({ error: "Error al guardar datos del emisor" });
    }
  });

  // ============================================
  // ENDPOINTS DE FACTURACIÓN (DTEs por Tenant)
  // ============================================

  app.get("/api/facturas", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const facturas = await storage.getFacturas(tenantId);
      res.json(facturas);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener facturas" });
    }
  });

  app.get("/api/facturas/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const factura = await storage.getFactura(req.params.id, tenantId);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }
      res.json(factura);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener factura" });
    }
  });

  app.post("/api/facturas", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = insertFacturaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validación fallida",
          details: parsed.error.errors 
        });
      }

      // Validar unicidad de código generación por tenant
      const codigoGen = parsed.data.codigoGeneracion;
      if (codigoGen) {
        const existente = await storage.getFacturaByCodigoGeneracion(codigoGen, tenantId);
        if (existente) {
          return res.status(400).json({
            error: "Código de generación ya existe",
            codigo: "DUPLICADO_CODIGO_GEN"
          });
        }
      }

      // Generar número de control en servidor usando tenantId
      const emisorNit = parsed.data.emisor?.nit || "00000000000000-0";
      const tipoDte = parsed.data.tipoDte || "01";
      const numeroControl = await storage.getNextNumeroControl(tenantId, emisorNit, tipoDte);
      
      const facturaConNumero = {
        ...parsed.data,
        numeroControl,
        tenantId
      };

      // Validación DGII Schema
      const dteValidation = validateDTESchema(facturaConNumero);
      if (!dteValidation.valid) {
        return res.status(400).json({
          error: "Validación DGII fallida",
          dgiiErrors: dteValidation.errors
        });
      }

      const factura = await storage.createFactura(tenantId, facturaConNumero);
      
      // ✅ NUEVO: Guardar automáticamente al cliente en el catálogo
      if (facturaConNumero.receptor) {
        await storage.upsertReceptor(tenantId, facturaConNumero.receptor);
      }

      res.status(201).json(factura);
    } catch (error) {
      console.error("Error creating factura:", error);
      res.status(500).json({ error: "Error al crear factura" });
    }
  });

  app.patch("/api/facturas/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const factura = await storage.updateFactura(req.params.id, tenantId, req.body);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada o sin permiso" });
      }
      res.json(factura);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar factura" });
    }
  });

  app.delete("/api/facturas/:id", ...requireManager, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const deleted = await storage.deleteFactura(req.params.id, tenantId);
      if (!deleted) {
        return res.status(404).json({ error: "Factura no encontrada o sin permiso" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar factura" });
    }
  });

  app.get("/api/facturas/:id/pdf", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const factura = await storage.getFactura(req.params.id, tenantId);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("DOCUMENTO TRIBUTARIO ELECTRONICO", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Tipo: ${factura.tipoDte === "01" ? "FACTURA" : "DTE-" + factura.tipoDte}`, pageWidth / 2, 28, { align: "center" });
      
      doc.setFontSize(10);
      doc.text(`Número de Control: ${factura.numeroControl}`, 15, 40);
      doc.text(`Código de Generación: ${factura.codigoGeneracion}`, 15, 46);
      doc.text(`Fecha: ${factura.fecEmi} ${factura.horEmi}`, 15, 52);
      
      doc.setFont("helvetica", "bold");
      doc.text("EMISOR:", 15, 64);
      doc.setFont("helvetica", "normal");
      doc.text(factura.emisor.nombre, 15, 70);
      doc.text(`NIT: ${factura.emisor.nit}`, 15, 76);
      doc.text(`NRC: ${factura.emisor.nrc}`, 15, 82);
      doc.text(`${factura.emisor.direccion.complemento}`, 15, 88);
      
      doc.setFont("helvetica", "bold");
      doc.text("RECEPTOR:", 110, 64);
      doc.setFont("helvetica", "normal");
      doc.text(factura.receptor.nombre, 110, 70);
      doc.text(`Doc: ${factura.receptor.numDocumento}`, 110, 76);
      if (factura.receptor.nrc) {
        doc.text(`NRC: ${factura.receptor.nrc}`, 110, 82);
      }
      doc.text(`${factura.receptor.direccion.complemento}`, 110, 88, { maxWidth: 80 });
      
      doc.setFont("helvetica", "bold");
      doc.text("DETALLE:", 15, 105);
      
      doc.setFillColor(240, 240, 240);
      doc.rect(15, 110, pageWidth - 30, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Cant.", 17, 115);
      doc.text("Descripción", 35, 115);
      doc.text("P. Unit.", 130, 115);
      doc.text("Total", 165, 115);
      
      doc.setFont("helvetica", "normal");
      let yPos = 125;
      factura.cuerpoDocumento.forEach((item) => {
        doc.text(item.cantidad.toString(), 17, yPos);
        doc.text(item.descripcion.substring(0, 50), 35, yPos);
        doc.text(`$${item.precioUni.toFixed(2)}`, 130, yPos);
        doc.text(`$${item.ventaGravada.toFixed(2)}`, 165, yPos);
        yPos += 7;
      });
      
      yPos += 10;
      doc.line(15, yPos - 5, pageWidth - 15, yPos - 5);
      
      doc.setFont("helvetica", "normal");
      doc.text("Subtotal:", 130, yPos);
      doc.text(`$${factura.resumen.subTotal.toFixed(2)}`, 165, yPos);
      yPos += 7;
      
      doc.text("IVA (13%):", 130, yPos);
      doc.text(`$${factura.resumen.totalIva.toFixed(2)}`, 165, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL A PAGAR:", 130, yPos);
      doc.text(`$${factura.resumen.totalPagar.toFixed(2)}`, 165, yPos);
      yPos += 10;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`SON: ${factura.resumen.totalLetras}`, 15, yPos);
      
      try {
        const qrData = JSON.stringify({
          codigoGeneracion: factura.codigoGeneracion,
          numeroControl: factura.numeroControl,
          fecEmi: factura.fecEmi,
          totalPagar: factura.resumen.totalPagar,
        });
        
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 80, margin: 1 });
        doc.addImage(qrDataUrl, "PNG", 15, yPos + 10, 35, 35);
      } catch (qrError) {
        console.error("Error generating QR code:", qrError);
      }
      
      const pdfBuffer = doc.output("arraybuffer");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=DTE-${factura.numeroControl}.pdf`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Error al generar PDF" });
    }
  });

  // ============================================
  // ENDPOINTS DE INTEGRACIÓN MH
  // ============================================
  
  app.post("/api/facturas/:id/transmitir", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const factura = await storage.getFactura(req.params.id, tenantId);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      if (factura.estado === "transmitida" || factura.estado === "sellada") {
        return res.status(400).json({ error: "Esta factura ya fue transmitida" });
      }

      // Transmitir al MH pasando el tenantId para usar sus credenciales
      const sello = await mhService.transmitirDTE(factura, tenantId);

      // Actualizar factura
      const nuevoEstado = sello.estado === "PROCESADO" ? "sellada" : "generada";
      const facturaActualizada = await storage.updateFactura(req.params.id, tenantId, {
        selloRecibido: sello.selloRecibido,
        estado: nuevoEstado
      });

      res.json({ 
        success: sello.estado === "PROCESADO",
        sello,
        factura: facturaActualizada 
      });
    } catch (error) {
      console.error("Error al transmitir factura:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Error al transmitir al MH" 
      });
    }
  });

  app.get("/api/mh/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const conectado = await mhService.verificarConexion(tenantId);
      const mockMode = process.env.MH_MOCK_MODE === "true" || !process.env.MH_API_TOKEN;
      
      res.json({
        conectado,
        modoSimulacion: mockMode,
        mensaje: mockMode 
          ? "Modo simulación activo"
          : conectado 
            ? "Conectado al MH"
            : "Sin conexión al MH"
      });
    } catch (error) {
      res.status(500).json({ conectado: false, error: "Error de estado MH" });
    }
  });

  app.get("/api/facturas/:id/estado-mh", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const factura = await storage.getFactura(req.params.id, tenantId);
      if (!factura) return res.status(404).json({ error: "No encontrada" });

      const estado = await mhService.consultarEstado(factura.codigoGeneracion, tenantId);
      res.json(estado);
    } catch (error) {
      res.status(500).json({ error: "Error al consultar MH" });
    }
  });

  // ============================================
  // ENDPOINTS DE DATOS DE PRUEBA (Solo Desarrollo)
  // ============================================
  
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/seed/facturas", requireAuth, async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        const { cantidad = 10 } = req.body;
        const facturasPrueba = generarFacturasPrueba(cantidad);
        
        const facturasCreadas = [];
        for (const factura of facturasPrueba) {
          const creada = await storage.createFactura(tenantId, factura);
          facturasCreadas.push(creada);
        }

        res.json({ success: true, cantidad: facturasCreadas.length });
      } catch (error) {
        res.status(500).json({ error: "Error al generar datos de prueba" });
      }
    });

    app.post("/api/seed/emisor", requireAuth, async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        const emisor = await storage.saveEmisor(tenantId, EMISOR_PRUEBA);
        res.json({ success: true, emisor });
      } catch (error) {
        res.status(500).json({ error: "Error al guardar emisor de prueba" });
      }
    });

    app.delete("/api/seed/facturas", requireAuth, async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        const facturas = await storage.getFacturas(tenantId);
        for (const factura of facturas) {
          if (factura.id) await storage.deleteFactura(factura.id, tenantId);
        }
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Error al limpiar facturas" });
      }
    });
  }

  return httpServer;
}
