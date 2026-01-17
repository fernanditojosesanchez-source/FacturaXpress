/**
 * Stock en Tránsito - Servicio de negocio
 * Gestión de movimientos de stock entre sucursales
 */

import { db } from "../db.js";
import { eq, and, or, desc, sql, count, sum } from "drizzle-orm";
import { 
  stockTransitoTable, 
  stockTransitoHistorialTable 
} from "../../shared/schema-stock-transito.js";
import { storage } from "../storage.js";
import { logAudit } from "./audit.js";
import { sendToSIEM } from "./siem.js";

interface CreateStockTransitoInput {
  sucursalOrigen: string;
  sucursalDestino: string;
  productoId: string;
  codigoProducto: string;
  nombreProducto: string;
  cantidadEnviada: number;
  referencia?: string;
  transportista?: string;
  numeroGuia?: string;
  costoTransporte?: number;
  observaciones?: string;
}

interface UpdateStockTransitoInput {
  estado?: string;
  cantidadRecibida?: number;
  cantidadDevuelta?: number;
  motivoDevolucion?: string;
  observaciones?: string;
  fechaRecepcion?: Date;
}

/**
 * Crea un nuevo movimiento de stock en tránsito
 */
export async function createStockTransito(
  tenantId: string,
  userId: string,
  data: CreateStockTransitoInput
): Promise<{
  id: string;
  numeroMovimiento: string;
  estado: string;
}> {
  try {
    // Generar número de movimiento único
    const numeroMovimiento = `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Crear registro en BD
    const [movimiento] = await db.insert(stockTransitoTable).values({
      tenantId,
      numeroMovimiento,
      sucursalOrigen: data.sucursalOrigen,
      sucursalDestino: data.sucursalDestino,
      productoId: data.productoId,
      codigoProducto: data.codigoProducto,
      nombreProducto: data.nombreProducto,
      cantidadEnviada: data.cantidadEnviada,
      cantidadRecibida: 0,
      cantidadDevuelta: 0,
      estado: 'pendiente',
      referencia: data.referencia,
      transportista: data.transportista,
      numeroGuia: data.numeroGuia,
      costoTransporte: data.costoTransporte ? data.costoTransporte.toString() : null,
      observaciones: data.observaciones,
      creadoPor: userId,
      modificadoPor: userId,
    }).returning();

    const id = movimiento.id;

    // Registrar en historial
    await db.insert(stockTransitoHistorialTable).values({
      stockTransitoId: id,
      estadoAnterior: null,
      estadoNuevo: 'pendiente',
      usuarioId: userId,
      nombreUsuario: 'Usuario', // Podríamos buscar el nombre real si lo necesitamos
      evento: 'creado',
      observaciones: `Movimiento creado: ${data.cantidadEnviada} unidades de ${data.nombreProducto}`,
    });

    console.log(
      `[StockTransito] Movimiento creado: ${numeroMovimiento} - ${data.productoId} (${data.cantidadEnviada} unidades)`
    );

    // Auditoría
    await logAudit({
      action: "stock_transito_created" as any,
      tenantId,
      userId,
      ipAddress: "system",
      details: {
        numeroMovimiento,
        productoId: data.productoId,
        sucursalOrigen: data.sucursalOrigen,
        sucursalDestino: data.sucursalDestino,
        cantidad: data.cantidadEnviada,
      },
    });

    // SIEM event
    await sendToSIEM({
      type: "stock_transito_created",
      level: "info",
      tenantId,
      details: {
        numeroMovimiento,
        producto: data.nombreProducto,
        origen: data.sucursalOrigen,
        destino: data.sucursalDestino,
        cantidad: data.cantidadEnviada,
      },
    });

    return {
      id,
      numeroMovimiento,
      estado: "pendiente",
    };
  } catch (error: any) {
    console.error("[StockTransito] Error creando movimiento:", error);

    await sendToSIEM({
      type: "stock_transito_error",
      level: "error",
      tenantId,
      details: {
        error: error.message,
        producto: data.productoId,
      },
    });

    throw error;
  }
}

/**
 * Actualiza estado de un movimiento de stock
 */
export async function updateStockTransito(
  tenantId: string,
  userId: string,
  movimientoId: string,
  data: UpdateStockTransitoInput
): Promise<void> {
  try {
    console.log(`[StockTransito] Actualizando movimiento ${movimientoId} → ${data.estado}`);

    // Obtener estado actual
    const [movimientoActual] = await db
      .select()
      .from(stockTransitoTable)
      .where(and(
        eq(stockTransitoTable.id, movimientoId),
        eq(stockTransitoTable.tenantId, tenantId)
      ))
      .limit(1);

    if (!movimientoActual) {
      throw new Error('Movimiento no encontrado');
    }

    // Actualizar movimiento
    await db
      .update(stockTransitoTable)
      .set({
        ...(data.estado && { estado: data.estado }),
        ...(data.cantidadRecibida !== undefined && { cantidadRecibida: data.cantidadRecibida }),
        ...(data.cantidadDevuelta !== undefined && { cantidadDevuelta: data.cantidadDevuelta }),
        ...(data.motivoDevolucion && { motivoDevolucion: data.motivoDevolucion }),
        ...(data.observaciones && { observaciones: data.observaciones }),
        ...(data.fechaRecepcion && { fechaRecepcion: data.fechaRecepcion }),
        modificadoPor: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(stockTransitoTable.id, movimientoId),
        eq(stockTransitoTable.tenantId, tenantId)
      ));

    // Registrar cambio en historial si cambió el estado
    if (data.estado && data.estado !== movimientoActual.estado) {
      await db.insert(stockTransitoHistorialTable).values({
        stockTransitoId: movimientoId,
        estadoAnterior: movimientoActual.estado,
        estadoNuevo: data.estado,
        usuarioId: userId,
        nombreUsuario: 'Usuario',
        evento: data.estado,
        observaciones: data.observaciones || `Estado cambiado de ${movimientoActual.estado} a ${data.estado}`,
      });
    }

    // Auditoría
    await logAudit({
      action: "stock_transito_updated" as any,
      tenantId,
      userId,
      ipAddress: "system",
      details: {
        movimientoId,
        cambios: data,
      },
    });

    // SIEM event
    await sendToSIEM({
      type: "stock_transito_updated",
      level: "info",
      tenantId,
      details: {
        movimientoId,
        nuevoEstado: data.estado,
        cantidadRecibida: data.cantidadRecibida,
      },
    });
  } catch (error: any) {
    console.error("[StockTransito] Error actualizando movimiento:", error);
    throw error;
  }
}

/**
 * Registra recepción de stock
 */
export async function receiveStockTransito(
  tenantId: string,
  userId: string,
  movimientoId: string,
  cantidadRecibida: number,
  observaciones?: string
): Promise<void> {
  try {
    console.log(`[StockTransito] Recibiendo ${cantidadRecibida} unidades de ${movimientoId}`);

    // Obtener movimiento actual
    const [movimiento] = await db
      .select()
      .from(stockTransitoTable)
      .where(and(
        eq(stockTransitoTable.id, movimientoId),
        eq(stockTransitoTable.tenantId, tenantId)
      ))
      .limit(1);

    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    // Determinar nuevo estado
    const cantidadEnviada = movimiento.cantidadEnviada;
    let nuevoEstado = 'recibido';
    if (cantidadRecibida < cantidadEnviada) {
      nuevoEstado = 'parcial';
    }

    // Actualizar recepción
    await db
      .update(stockTransitoTable)
      .set({
        cantidadRecibida,
        estado: nuevoEstado,
        fechaRecepcion: new Date(),
        observaciones: observaciones || movimiento.observaciones,
        modificadoPor: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(stockTransitoTable.id, movimientoId),
        eq(stockTransitoTable.tenantId, tenantId)
      ));

    // Registrar en historial
    await db.insert(stockTransitoHistorialTable).values({
      stockTransitoId: movimientoId,
      estadoAnterior: movimiento.estado,
      estadoNuevo: nuevoEstado,
      usuarioId: userId,
      nombreUsuario: 'Usuario',
      evento: 'recibido',
      observaciones: `Recibidas ${cantidadRecibida} de ${cantidadEnviada} unidades. ${observaciones || ''}`,
    });

    // Auditoría
    await logAudit({
      action: "stock_transito_received" as any,
      tenantId,
      userId,
      ipAddress: "system",
      details: {
        movimientoId,
        cantidadRecibida,
        observaciones,
      },
    });

    // SIEM event
    await sendToSIEM({
      type: "stock_transito_received",
      level: "info",
      tenantId,
      details: {
        movimientoId,
        cantidad: cantidadRecibida,
      },
    });
  } catch (error: any) {
    console.error("[StockTransito] Error recibiendo stock:", error);
    throw error;
  }
}

/**
 * Registra devolución de stock
 */
export async function devuelveStockTransito(
  tenantId: string,
  userId: string,
  movimientoId: string,
  cantidadDevuelta: number,
  motivo: string
): Promise<void> {
  try {
    console.log(`[StockTransito] Devolviendo ${cantidadDevuelta} unidades de ${movimientoId}: ${motivo}`);

    // Actualizar devolución
    await db
      .update(stockTransitoTable)
      .set({
        cantidadDevuelta,
        estado: 'devuelto',
        motivoDevolucion: motivo,
        modificadoPor: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(stockTransitoTable.id, movimientoId),
        eq(stockTransitoTable.tenantId, tenantId)
      ));

    // Registrar en historial
    await db.insert(stockTransitoHistorialTable).values({
      stockTransitoId: movimientoId,
      estadoAnterior: 'recibido',
      estadoNuevo: 'devuelto',
      usuarioId: userId,
      nombreUsuario: 'Usuario',
      evento: 'devuelto',
      observaciones: `Devueltas ${cantidadDevuelta} unidades. Motivo: ${motivo}`,
    });

    // Auditoría
    await logAudit({
      action: "stock_transito_returned" as any,
      tenantId,
      userId,
      ipAddress: "system",
      details: {
        movimientoId,
        cantidadDevuelta,
        motivo,
      },
    });

    // SIEM event
    await sendToSIEM({
      type: "stock_transito_returned",
      level: "warn",
      tenantId,
      details: {
        movimientoId,
        cantidad: cantidadDevuelta,
        motivo,
      },
    });
  } catch (error: any) {
    console.error("[StockTransito] Error devolviendo stock:", error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de stock en tránsito
 */
export async function getStockTransitoStats(
  tenantId: string
): Promise<{
  total: number;
  pendiente: number;
  enTransito: number;
  recibido: number;
  problemas: number;
  valorTotal: number;
}> {
  // Contar movimientos por estado
  const [stats] = await db
    .select({
      total: count(),
      pendiente: sql<number>`count(*) filter (where ${stockTransitoTable.estado} = 'pendiente')`,
      enTransito: sql<number>`count(*) filter (where ${stockTransitoTable.estado} in ('enviado', 'en_transporte'))`,
      recibido: sql<number>`count(*) filter (where ${stockTransitoTable.estado} = 'recibido')`,
      problemas: sql<number>`count(*) filter (where ${stockTransitoTable.estado} in ('parcial', 'devuelto'))`,
      valorTotal: sql<number>`coalesce(sum(${stockTransitoTable.costoTransporte}::decimal), 0)`,
    })
    .from(stockTransitoTable)
    .where(eq(stockTransitoTable.tenantId, tenantId));

  return {
    total: Number(stats?.total || 0),
    pendiente: Number(stats?.pendiente || 0),
    enTransito: Number(stats?.enTransito || 0),
    recibido: Number(stats?.recibido || 0),
    problemas: Number(stats?.problemas || 0),
    valorTotal: Number(stats?.valorTotal || 0),
  };
}
