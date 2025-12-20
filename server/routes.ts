import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emisorSchema, insertFacturaSchema } from "@shared/schema";
import { z } from "zod";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
      const parsed = insertFacturaSchema.safeParse(req.body);
      if (!parsed.success) {
        console.log("Validation errors:", parsed.error.errors);
        return res.status(400).json({ error: parsed.error.errors });
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

  return httpServer;
}
