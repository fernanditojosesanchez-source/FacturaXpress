
import { Factura, ItemFactura } from "../../shared/schema.js";

/**
 * Mapeador de Factura (Modelo Interno) a DTE JSON (Estándar MH v3)
 * 
 * El modelo interno 'Factura' es plano para facilitar persistencia en DB,
 * pero el estándar DTE requiere estructuras anidadas (identificacion, resumen, etc).
 */
// Helper para redondeo estricto DTE
const toFixedNumber = (num: number, digits: number = 2) => Number(num.toFixed(digits));
// Helper para truncar strings (evitar rechazos por longitud)
function truncate(str: string | null | undefined, max: number): string | null {
    return str ? str.substring(0, max) : null;
}

/**
 * Mapeador de Factura (Modelo Interno) a DTE JSON (Estándar MH v3)
 * 
 * El modelo interno 'Factura' es plano para facilitar persistencia en DB,
 * pero el estándar DTE requiere estructuras anidadas (identificacion, resumen, etc).
 */
export function mapFacturaToDteJson(factura: Factura): any {
    // 1. Validaciones básicas
    if (!factura.codigoGeneracion) throw new Error("Falta codigoGeneracion");
    if (!factura.numeroControl) throw new Error("Falta numeroControl");
    if (!factura.emisor) throw new Error("Falta emisor");
    if (!factura.receptor) throw new Error("Falta receptor");
    if (!factura.cuerpoDocumento) throw new Error("Falta cuerpoDocumento");

    // 2. Construcción de secciones
    const identificacion = {
        version: factura.version || 1, // V3 estándar: 1 o 3 según tipo
        ambiente: factura.ambiente || "00",
        tipoDte: factura.tipoDte || "01",
        numeroControl: factura.numeroControl,
        codigoGeneracion: factura.codigoGeneracion,
        tipoModelo: 1, // Siempre 1 para Modelo Previo/Diferido
        tipoOperacion: 1, // 1=Normal, 2=Contingencia
        fecEmi: factura.fecEmi, // YYYY-MM-DD
        horEmi: factura.horEmi, // HH:MM:SS
        tipoMoneda: factura.tipoMoneda || "USD",
        tipoContingencia: factura.tipoContingencia ? parseInt(factura.tipoContingencia) : null,
        motivoContin: truncate(factura.motivoContin, 250),
    };

    // Limpiar nulos en identificación
    Object.keys(identificacion).forEach(key => {
        if ((identificacion as any)[key] === null) delete (identificacion as any)[key];
    });

    const documentoRelacionado = null;

    const emisor = {
        nit: factura.emisor.nit.replace(/-/g, ''), // Sin guiones
        nrc: factura.emisor.nrc.replace(/-/g, ''),
        nombre: truncate(factura.emisor.nombre, 250),
        codActividad: factura.emisor.codActividad,
        descActividad: truncate(factura.emisor.descActividad, 150),
        direccion: {
            departamento: factura.emisor.direccion.departamento,
            municipio: factura.emisor.direccion.municipio,
            complemento: truncate(factura.emisor.direccion.complemento, 200)
        },
        telefono: truncate(factura.emisor.telefono, 20),
        correo: truncate(factura.emisor.correo, 50),
        tipoEstablecimiento: factura.emisor.tipoEstablecimiento || "1",
    };

    const receptor = {
        nit: (factura.receptor.tipoDocumento === "36" && factura.receptor.numDocumento)
            ? factura.receptor.numDocumento.replace(/-/g, '')
            : null,
        nrc: factura.receptor.nrc ? factura.receptor.nrc.replace(/-/g, '') : null,
        nombre: truncate(factura.receptor.nombre, 250),
        codActividad: factura.receptor.codActividad || null,
        descActividad: truncate(factura.receptor.descActividad, 150),
        direccion: {
            departamento: factura.receptor.direccion.departamento,
            municipio: factura.receptor.direccion.municipio,
            complemento: truncate(factura.receptor.direccion.complemento, 200)
        },
        telefono: truncate(factura.receptor.telefono, 20) || null,
        correo: truncate(factura.receptor.correo, 50),
        tipoDocumento: factura.receptor.tipoDocumento || "36",
        numDocumento: (factura.receptor.tipoDocumento !== "36")
            ? factura.receptor.numDocumento
            : null,
    };

    // Limpiar nulos de receptor
    Object.keys(receptor).forEach(key => {
        if ((receptor as any)[key] === null) delete (receptor as any)[key];
    });

    // Mapeo detallado de items
    const cuerpoDocumento = factura.cuerpoDocumento.map((item, index) => ({
        numItem: index + 1,
        tipoItem: parseInt(item.tipoItem || "1"),
        numeroDocumento: null,
        cantidad: toFixedNumber(item.cantidad, 3), // Hasta 3 decimales en cantidad
        codigo: truncate(item.codigo, 25) || null,
        codTributo: null,
        uniMedida: parseInt(String(item.uniMedida)), // Asegurar entero
        descripcion: truncate(item.descripcion, 1000) || "Item sin descripción",
        precioUni: toFixedNumber(item.precioUni, 4), // Precios unitarios hasta 4 decimales
        montoDescu: toFixedNumber(item.montoDescu || 0, 2),
        ventaNoSuj: toFixedNumber(item.ventaNoSuj || 0, 2),
        ventaExenta: toFixedNumber(item.ventaExenta || 0, 2),
        ventaGravada: toFixedNumber(item.ventaGravada || 0, 2),
        tributos: item.tributos || null,
        psv: 0,
        noGravado: 0,
        ivaItem: toFixedNumber(item.ivaItem || 0, 2),
    }));

    const resumen = {
        totalNoSuj: toFixedNumber(factura.resumen.totalNoSuj),
        totalExenta: toFixedNumber(factura.resumen.totalExenta),
        totalGravada: toFixedNumber(factura.resumen.totalGravada),
        subTotalVentas: toFixedNumber(factura.resumen.subTotalVentas),
        descuNoSuj: toFixedNumber(factura.resumen.descuNoSuj),
        descuExenta: toFixedNumber(factura.resumen.descuExenta),
        descuGravada: toFixedNumber(factura.resumen.descuGravada),
        porcentajeDescuento: toFixedNumber(factura.resumen.porcentajeDescuento),
        totalDescu: toFixedNumber(factura.resumen.totalDescu),
        tributos: factura.resumen.tributos || null,
        subTotal: toFixedNumber(factura.resumen.subTotal),
        ivaRete1: toFixedNumber(factura.resumen.ivaRete1),
        reteRenta: toFixedNumber(factura.resumen.reteRenta),
        montoTotalOperacion: toFixedNumber(factura.resumen.montoTotalOperacion),
        totalNoGravado: toFixedNumber(factura.resumen.totalNoGravado),
        totalPagar: toFixedNumber(factura.resumen.totalPagar),
        totalLetras: factura.resumen.totalLetras,
        totalIva: toFixedNumber(factura.resumen.totalIva),
        saldoFavor: toFixedNumber(factura.resumen.saldoFavor),
        condicionOperacion: parseInt(factura.resumen.condicionOperacion || "1"),
        pagos: factura.resumen.pagos || null,
        numPagoElectronico: factura.resumen.numPagoElectronico || null,
    };

    // Limpiar nulos de resumen
    if (!resumen.tributos) delete (resumen as any).tributos;
    if (!resumen.pagos) delete (resumen as any).pagos;
    if (!resumen.numPagoElectronico) delete (resumen as any).numPagoElectronico;

    const extension = factura.extension || null;
    const apendice = factura.apendice || null;

    // Estructura Final DTE v3
    return {
        identificacion,
        documentoRelacionado,
        emisor,
        receptor,
        cuerpoDocumento,
        resumen,
        extension,
        apendice,
    };
}
