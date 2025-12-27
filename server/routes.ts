import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emisorSchema, insertFacturaSchema } from "@shared/schema";
import { z } from "zod";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { mhService } from "./mh-service";
import { generarFacturasPrueba, EMISOR_PRUEBA } from "./seed-data";
import { registerAuthRoutes } from "./auth";
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Rutas de autenticación
  registerAuthRoutes(app);

  // ============================================
  // ENDPOINTS DE CATÁLOGOS DGII
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
  // VALIDACIÓN DTE CONTRA SCHEMA DGII
  // ============================================
  app.post("/api/validar-dte", (req: Request, res: Response) => {
    try {
      console.log("[validar-dte] Request body:", JSON.stringify(req.body).substring(0, 100));
      
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          valid: false,
          errors: [{ field: "root", message: "Request body must be a JSON object" }]
        });
      }

      const dteValidation = validateDTESchema(req.body);
      console.log("[validar-dte] Validation result:", dteValidation.valid);
      
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
  
  app.get("/api/emisor", async (req: Request, res: Response) => {
    try {
      const emisor = await storage.getEmisor();
      if (!emisor) {
        return res.json({});
      }
      res.json(emisor);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener datos del emisor" });
    }
  });

  app.post("/api/emisor", async (req: Request, res: Response) => {
    try {
      const parsed = emisorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const emisor = await storage.saveEmisor(parsed.data);
      res.json(emisor);
    } catch (error) {
      res.status(500).json({ error: "Error al guardar datos del emisor" });
    }
  });

  app.get("/api/facturas", async (req: Request, res: Response) => {
    try {
      const facturas = await storage.getFacturas();
      res.json(facturas);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener facturas" });
    }
  });

  app.get("/api/facturas/:id", async (req: Request, res: Response) => {
    try {
      const factura = await storage.getFactura(req.params.id);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }
      res.json(factura);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener factura" });
    }
  });

  app.post("/api/facturas", async (req: Request, res: Response) => {
    try {
      // Validación Zod
      const parsed = insertFacturaSchema.safeParse(req.body);
      if (!parsed.success) {
        console.log("Validation errors:", parsed.error.errors);
        return res.status(400).json({ 
          error: "Validación fallida",
          details: parsed.error.errors 
        });
      }

      // Validación DGII Schema (validar estructura DTE)
      const dteValidation = validateDTESchema(parsed.data);
      if (!dteValidation.valid) {
        return res.status(400).json({
          error: "Validación DGII fallida",
          dgiiErrors: dteValidation.errors
        });
      }

      const factura = await storage.createFactura(parsed.data);
      res.status(201).json(factura);
    } catch (error) {
      console.error("Error creating factura:", error);
      res.status(500).json({ error: "Error al crear factura" });
    }
  });

  app.patch("/api/facturas/:id", async (req: Request, res: Response) => {
    try {
      const factura = await storage.updateFactura(req.params.id, req.body);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }
      res.json(factura);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar factura" });
    }
  });

  app.delete("/api/facturas/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteFactura(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar factura" });
    }
  });

  app.get("/api/facturas/:id/pdf", async (req: Request, res: Response) => {
    try {
      const factura = await storage.getFactura(req.params.id);
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
      
      const qrData = JSON.stringify({
        codigoGeneracion: factura.codigoGeneracion,
        numeroControl: factura.numeroControl,
        fecEmi: factura.fecEmi,
        totalPagar: factura.resumen.totalPagar,
      });
      
      try {
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 80, margin: 1 });
        doc.addImage(qrDataUrl, "PNG", 15, yPos + 10, 35, 35);
      } catch (qrError) {
        console.error("Error generating QR code:", qrError);
      }
      
      doc.setFontSize(7);
      doc.text("Este documento es una representación gráfica de un DTE", pageWidth / 2, yPos + 50, { align: "center" });
      doc.text("Sistema de Facturación Electrónica El Salvador", pageWidth / 2, yPos + 55, { align: "center" });
      
      const pdfBuffer = doc.output("arraybuffer");
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=DTE-${factura.numeroControl}.pdf`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Error al generar PDF" });
    }
  });

  app.get("/api/facturas/:id/json", async (req: Request, res: Response) => {
    try {
      const factura = await storage.getFactura(req.params.id);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }
      
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=DTE-${factura.numeroControl}.json`);
      res.json(factura);
    } catch (error) {
      res.status(500).json({ error: "Error al generar JSON" });
    }
  });

  // ============================================
  // ENDPOINTS DE INTEGRACIÓN MH
  // ============================================
  
  // Transmitir factura al Ministerio de Hacienda
  app.post("/api/facturas/:id/transmitir", async (req: Request, res: Response) => {
    try {
      const factura = await storage.getFactura(req.params.id);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      // Verificar que la factura esté en estado válido para transmitir
      if (factura.estado === "transmitida" || factura.estado === "sellada") {
        return res.status(400).json({ 
          error: "Esta factura ya fue transmitida al MH" 
        });
      }

      if (factura.estado === "anulada") {
        return res.status(400).json({ 
          error: "No se puede transmitir una factura anulada" 
        });
      }

      // Transmitir al MH (mock o real según configuración)
      const sello = await mhService.transmitirDTE(factura);

      // Actualizar factura con el sello recibido
      const nuevoEstado = sello.estado === "PROCESADO" ? "sellada" : "generada";
      const facturaActualizada = await storage.updateFactura(req.params.id, {
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

  // Consultar estado de DTE en el MH
  app.get("/api/facturas/:id/estado-mh", async (req: Request, res: Response) => {
    try {
      const factura = await storage.getFactura(req.params.id);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      const estado = await mhService.consultarEstado(factura.codigoGeneracion);
      
      res.json(estado);
    } catch (error) {
      console.error("Error al consultar estado:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Error al consultar estado en el MH" 
      });
    }
  });

  // Anular DTE en el MH
  app.post("/api/facturas/:id/anular", async (req: Request, res: Response) => {
    try {
      const { motivo } = req.body;
      
      if (!motivo || motivo.trim().length === 0) {
        return res.status(400).json({ 
          error: "El motivo de anulación es requerido" 
        });
      }

      const factura = await storage.getFactura(req.params.id);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      // Verificar que la factura pueda ser anulada
      if (factura.estado === "anulada") {
        return res.status(400).json({ 
          error: "Esta factura ya está anulada" 
        });
      }

      if (factura.estado !== "sellada" && factura.estado !== "transmitida") {
        return res.status(400).json({ 
          error: "Solo se pueden anular facturas que han sido transmitidas al MH" 
        });
      }

      // Anular en el MH
      const resultado = await mhService.anularDTE(factura.codigoGeneracion, motivo);

      // Actualizar estado local
      if (resultado.success) {
        await storage.updateFactura(req.params.id, {
          estado: "anulada"
        });
      }

      res.json(resultado);
    } catch (error) {
      console.error("Error al anular factura:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Error al anular en el MH" 
      });
    }
  });

  // Verificar estado de la conexión con el MH
  app.get("/api/mh/status", async (req: Request, res: Response) => {
    try {
      const conectado = await mhService.verificarConexion();
      const mockMode = process.env.MH_MOCK_MODE === "true" || !process.env.MH_API_TOKEN;
      
      res.json({
        conectado,
        modoSimulacion: mockMode,
        mensaje: mockMode 
          ? "Modo simulación activo - No se transmite al MH real"
          : conectado 
            ? "Conectado al MH"
            : "No se pudo conectar al MH"
      });
    } catch (error) {
      res.status(500).json({ 
        conectado: false,
        error: "Error al verificar conexión" 
      });
    }
  });

  // ============================================
  // ENDPOINTS DE DATOS DE PRUEBA
  // ============================================
  
  // Generar datos de prueba
  app.post("/api/seed/facturas", async (req: Request, res: Response) => {
    try {
      const { cantidad = 10 } = req.body;
      
      if (cantidad < 1 || cantidad > 100) {
        return res.status(400).json({ 
          error: "La cantidad debe estar entre 1 y 100" 
        });
      }

      // Generar facturas de prueba
      const facturasPrueba = generarFacturasPrueba(cantidad);
      
      // Guardar en storage
      const facturasCreadas = [];
      for (const factura of facturasPrueba) {
        const creada = await storage.createFactura(factura);
        facturasCreadas.push(creada);
      }

      res.json({
        success: true,
        cantidad: facturasCreadas.length,
        mensaje: `Se generaron ${facturasCreadas.length} facturas de prueba`
      });
    } catch (error) {
      console.error("Error al generar datos de prueba:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Error al generar datos de prueba" 
      });
    }
  });

  // Guardar emisor de prueba
  app.post("/api/seed/emisor", async (req: Request, res: Response) => {
    try {
      const emisor = await storage.saveEmisor(EMISOR_PRUEBA);
      res.json({
        success: true,
        emisor
      });
    } catch (error) {
      console.error("Error al guardar emisor de prueba:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Error al guardar emisor" 
      });
    }
  });

  // Limpiar todas las facturas
  app.delete("/api/seed/facturas", async (req: Request, res: Response) => {
    try {
      const facturas = await storage.getFacturas();
      let eliminadas = 0;
      
      for (const factura of facturas) {
        if (factura.id) {
          await storage.deleteFactura(factura.id);
          eliminadas++;
        }
      }

      res.json({
        success: true,
        cantidad: eliminadas,
        mensaje: `Se eliminaron ${eliminadas} facturas`
      });
    } catch (error) {
      console.error("Error al limpiar facturas:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Error al limpiar datos" 
      });
    }
  });

  // Crear usuario de prueba (admin/admin)
  app.post("/api/seed/usuario", async (_req: Request, res: Response) => {
    try {
      const existente = await storage.getUserByUsername("admin");
      if (existente) {
        return res.json({ success: true, usuario: { id: existente.id, username: existente.username } });
      }
      const creado = await storage.createUser({ username: "admin", password: "admin" });
      res.json({ success: true, usuario: { id: creado.id, username: creado.username } });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Error al crear usuario de prueba" });
    }
  });

  return httpServer;
}
