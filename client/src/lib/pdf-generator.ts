import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { Factura } from "@shared/schema";

/**
 * Genera un PDF a partir de un elemento HTML
 */
export async function generatePDFFromElement(
  element: HTMLElement,
  filename: string
): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter",
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } catch (error) {
    console.error("Error generando PDF:", error);
    throw error;
  }
}

/**
 * Genera un HTML para previsualizar la factura
 */
export function generateFacturaHTML(factura: Factura): string {
  const total = factura.resumen.totalPagar;
  const itemsHtml = factura.cuerpoDocumento
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align:center; padding:8px; border-bottom:1px solid #ddd;">${idx + 1}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd;">${item.descripcion}</td>
      <td style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">${item.cantidad}</td>
      <td style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">$${item.precioUni.toFixed(2)}</td>
      <td style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">$${(item.precioUni * item.cantidad - item.montoDescu).toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px;">
        <div>
          <h1 style="margin: 0; font-size: 28px; color: #333;">Factura Electrónica</h1>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">DGII - El Salvador</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-weight: bold; font-size: 14px;">No. Control:</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">${factura.numeroControl}</p>
        </div>
      </div>

      <!-- Datos Emisor y Receptor -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
        <div>
          <h3 style="margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase;">Emisor</h3>
          <p style="margin: 5px 0; font-weight: bold;">${factura.emisor.nombre}</p>
          <p style="margin: 3px 0; font-size: 12px;">NIT: ${factura.emisor.nit}</p>
          <p style="margin: 3px 0; font-size: 12px;">NRC: ${factura.emisor.nrc}</p>
          <p style="margin: 3px 0; font-size: 12px;">${factura.emisor.direccion.complemento}</p>
        </div>
        <div>
          <h3 style="margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase;">Receptor</h3>
          <p style="margin: 5px 0; font-weight: bold;">${factura.receptor.nombre}</p>
          <p style="margin: 3px 0; font-size: 12px;">Documento: ${factura.receptor.numDocumento}</p>
          <p style="margin: 3px 0; font-size: 12px;">${factura.receptor.direccion?.complemento || ""}</p>
        </div>
      </div>

      <!-- Datos de la Factura -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <div>
          <p style="margin: 0; font-size: 11px; color: #666;">Fecha:</p>
          <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 13px;">${factura.fecEmi}</p>
        </div>
        <div>
          <p style="margin: 0; font-size: 11px; color: #666;">Condición:</p>
          <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 13px;">${factura.resumen.condicionOperacion === "1" ? "Contado" : "Crédito"}</p>
        </div>
        <div>
          <p style="margin: 0; font-size: 11px; color: #666;">Código Generación:</p>
          <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 11px; word-break: break-all;">${factura.codigoGeneracion}</p>
        </div>
      </div>

      <!-- Tabla de Items -->
      <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
        <thead>
          <tr style="background: #333; color: white;">
            <th style="text-align: center; padding: 10px; font-size: 12px;">#</th>
            <th style="text-align: left; padding: 10px; font-size: 12px;">Descripción</th>
            <th style="text-align: right; padding: 10px; font-size: 12px;">Cantidad</th>
            <th style="text-align: right; padding: 10px; font-size: 12px;">Precio Unit.</th>
            <th style="text-align: right; padding: 10px; font-size: 12px;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Totales -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
        <div style="width: 300px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 12px;">
            <span>Subtotal Gravado:</span>
            <span style="font-weight: bold;">$${factura.resumen.totalGravada?.toFixed(2) || "0.00"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 12px;">
            <span>IVA (13%):</span>
            <span style="font-weight: bold;">$${factura.resumen.totalIva?.toFixed(2) || "0.00"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 12px 0; background: #f0f0f0; border-radius: 3px; padding: 12px;">
            <span style="font-weight: bold; font-size: 14px;">TOTAL A PAGAR:</span>
            <span style="font-weight: bold; font-size: 16px; color: #333;">$${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align: center; border-top: 1px solid #ddd; padding-top: 15px; color: #666; font-size: 11px;">
        <p style="margin: 0;">Documento generado electrónicamente - No requiere firma</p>
        <p style="margin: 5px 0 0 0;">Válido ante el Ministerio de Hacienda de El Salvador</p>
      </div>
    </div>
  `;
}
