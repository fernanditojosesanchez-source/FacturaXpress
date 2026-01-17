/**
 * Stock en Tránsito - Modelo de datos
 * Seguimiento de stock moviéndose entre sucursales
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, jsonb, uuid, boolean, index } from "drizzle-orm/pg-core";

export const stockTransitoTable = pgTable(
  "stock_transito",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull(),
    
    // Identificación del movimiento
    numeroMovimiento: varchar("numero_movimiento", { length: 50 }).notNull(),
    referencia: varchar("referencia", { length: 100 }),
    
    // Origen y destino
    sucursalOrigen: varchar("sucursal_origen", { length: 50 }).notNull(),
    sucursalDestino: varchar("sucursal_destino", { length: 50 }).notNull(),
    
    // Producto
    productoId: uuid("producto_id").notNull(),
    codigoProducto: varchar("codigo_producto", { length: 100 }).notNull(),
    nombreProducto: varchar("nombre_producto", { length: 255 }).notNull(),
    
    // Cantidades
    cantidadEnviada: integer("cantidad_enviada").notNull(),
    cantidadRecibida: integer("cantidad_recibida").default(0),
    cantidadDevuelta: integer("cantidad_devuelta").default(0),
    
    // Estados
    estado: varchar("estado", { length: 50 }).notNull().default("pendiente"), 
    // pendiente, enviado, en_transporte, recibido, parcial, devuelto, cancelado
    
    // Fechas
    fechaEnvio: timestamp("fecha_envio"),
    fechaEsperadaEntrega: timestamp("fecha_esperada_entrega"),
    fechaRecepcion: timestamp("fecha_recepcion"),
    
    // Detalles de transporte
    transportista: varchar("transportista", { length: 100 }),
    numeroGuia: varchar("numero_guia", { length: 100 }),
    costoTransporte: decimal("costo_transporte", { precision: 12, scale: 2 }),
    
    // Observaciones
    observaciones: text("observaciones"),
    motivoDevolucion: text("motivo_devolucion"),
    
    // Auditoría
    creadoPor: uuid("creado_por").notNull(),
    modificadoPor: uuid("modificado_por"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_stock_transito_tenant").on(table.tenantId),
    index("idx_stock_transito_estado").on(table.estado),
    index("idx_stock_transito_numero").on(table.numeroMovimiento),
    index("idx_stock_transito_origen_destino").on(table.sucursalOrigen, table.sucursalDestino),
  ]
);

export const stockTransitoDetallesTable = pgTable(
  "stock_transito_detalles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    stockTransitoId: uuid("stock_transito_id")
      .references(() => stockTransitoTable.id)
      .notNull(),
    
    // Lotes/series
    lote: varchar("lote", { length: 100 }),
    numeroSerie: varchar("numero_serie", { length: 100 }),
    
    // Cantidades por lote
    cantidadEnviada: integer("cantidad_enviada").notNull(),
    cantidadRecibida: integer("cantidad_recibida").default(0),
    
    // Calidad/inspección
    inspeccionado: boolean("inspeccionado").default(false),
    fechaInspeccion: timestamp("fecha_inspeccion"),
    estadoInspeccion: varchar("estado_inspeccion", { length: 50 }), // aprobado, rechazado, parcial
    observacionesInspeccion: text("observaciones_inspeccion"),
    
    // Metadata
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_stock_transito_detalles_padre").on(table.stockTransitoId),
    index("idx_stock_transito_detalles_lote").on(table.lote),
  ]
);

export const stockTransitoHistorialTable = pgTable(
  "stock_transito_historial",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    stockTransitoId: uuid("stock_transito_id")
      .references(() => stockTransitoTable.id)
      .notNull(),
    
    // Cambio de estado
    estadoAnterior: varchar("estado_anterior", { length: 50 }),
    estadoNuevo: varchar("estado_nuevo", { length: 50 }).notNull(),
    
    // Quien hizo el cambio
    usuarioId: uuid("usuario_id").notNull(),
    nombreUsuario: varchar("nombre_usuario", { length: 255 }),
    
    // Evento
    evento: varchar("evento", { length: 100 }).notNull(), 
    // creado, enviado, recibido, rechazado, devuelto, cancelado
    
    // Detalles del evento
    ubicacion: varchar("ubicacion", { length: 255 }),
    evidencia: jsonb("evidencia"), // Fotos, PDF, etc.
    observaciones: text("observaciones"),
    
    // Timestamp
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_stock_transito_historial_padre").on(table.stockTransitoId),
    index("idx_stock_transito_historial_evento").on(table.evento),
    index("idx_stock_transito_historial_fecha").on(table.createdAt),
  ]
);
