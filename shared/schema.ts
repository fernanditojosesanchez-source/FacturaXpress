import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, jsonb, serial, unique, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- TABLAS PARA MULTI-TENANCY ---

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nombre: text("nombre").notNull(),
  slug: text("slug").unique().notNull(),
  tipo: text("tipo").default("clinic"), // clinic, hospital, lab, store
  estado: text("estado").default("activo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenantCredentials = pgTable("tenant_credentials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  mhUsuario: text("mh_usuario"),
  mhPassEnc: text("mh_pass_enc").notNull(),
  certificadoP12Enc: text("cert_p12_enc").notNull(),
  certificadoPassEnc: text("cert_pass_enc").notNull(),
  ambiente: text("ambiente").default("pruebas"),
  validoDesde: timestamp("valido_desde"),
  validoHasta: timestamp("valido_hasta"),
  activo: boolean("activo").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- TABLAS DE NEGOCIO ACTUALIZADAS ---

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // super_admin, tenant_admin, manager, cashier
});

export const emisorTable = pgTable("emisor", {
  id: text("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  data: jsonb("data").notNull(),
});

export const facturasTable = pgTable("facturas", {
  id: text("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  data: jsonb("data").notNull(), // El DTE completo enviado (auditoría)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  fecEmi: text("fec_emi").notNull(),
  estado: text("estado").notNull().default("borrador"), // borrador, generada, transmitida, sellada, anulada
  codigoGeneracion: text("codigo_generacion").unique(),
  selloRecibido: text("sello_recibido"),
});

export const facturaItemsTable = pgTable("factura_items", {
  id: serial("id").primaryKey(),
  facturaId: text("factura_id").references(() => facturasTable.id),
  numItem: integer("num_item").notNull(),
  tipoItem: text("tipo_item").notNull(),
  cantidad: decimal("cantidad", { precision: 12, scale: 6 }).notNull(),
  codigo: text("codigo"),
  descripcion: text("descripcion").notNull(),
  precioUni: decimal("precio_uni", { precision: 12, scale: 6 }).notNull(),
  ventaNoSuj: decimal("venta_no_suj", { precision: 12, scale: 2 }).notNull().default("0"),
  ventaExenta: decimal("venta_exenta", { precision: 12, scale: 2 }).notNull().default("0"),
  ventaGravada: decimal("venta_gravada", { precision: 12, scale: 2 }).notNull().default("0"),
  tributos: jsonb("tributos"),
  ivaItem: decimal("iva_item", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const secuencialControlTable = pgTable("secuencial_control", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  emisorNit: text("emisor_nit").notNull(),
  tipoDte: text("tipo_dte").notNull(),
  secuencial: integer("secuencial").notNull().default(1),
  ultimoNumeroControl: text("ultimo_numero_control"),
  fechaCreacion: timestamp("fecha_creacion").notNull().defaultNow(),
  fechaActualizacion: timestamp("fecha_actualizacion").notNull().defaultNow(),
}, (t) => ({
  unq: unique().on(t.tenantId, t.emisorNit, t.tipoDte),
}));

// --- CATÁLOGOS GLOBALES ---

export const mhCatalogosTable = pgTable("mh_catalogos", {
  id: serial("id").primaryKey(),
  catalogo: text("catalogo").notNull(), // 'departamentos', 'municipios', 'actividades', etc.
  codigo: text("codigo").notNull(),
  valor: text("valor").notNull(),
  padre: text("padre"), // Para municipios, el padre es el código de departamento
  activo: boolean("activo").default(true),
}, (t) => ({
  unq_cat: unique().on(t.catalogo, t.codigo),
}));

// --- SCHEMAS DE ZOD ---

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  tenantId: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;

export const emisorSchema = z.object({
  nit: z.string()
    .min(1, "NIT es requerido")
    .regex(/^\d{14}-\d$/, "NIT inválido. Formato: 14 dígitos-1 dígito")
    .max(16, "NIT muy largo"),
  nrc: z.string().min(1, "NRC es requerido"),
  nombre: z.string().min(1, "Nombre es requerido").max(100),
  codActividad: z.string().min(1, "Código de actividad es requerido"),
  descActividad: z.string().min(1, "Descripción de actividad es requerida"),
  nombreComercial: z.string().optional(),
  tipoEstablecimiento: z.string().default("01"),
  direccion: z.object({
    departamento: z.string().min(1, "Departamento es requerido"),
    municipio: z.string().min(1, "Municipio es requerido"),
    complemento: z.string().min(1, "Dirección es requerida"),
  }),
  telefono: z.string().min(1, "Teléfono es requerido").regex(/^\d{8}$/, "Teléfono debe tener 8 dígitos"),
  correo: z.string().email("Correo inválido"),
  codEstableMH: z.string().optional(),
  codEstable: z.string().optional(),
  codPuntoVentaMH: z.string().optional(),
  codPuntoVenta: z.string().optional(),
  logo: z.string().optional(), // Base64 del logo
});

export const receptorSchema = z.object({
  tipoDocumento: z.enum(["36", "13", "02", "03", "37"]).default("36"),
  numDocumento: z.string()
    .min(1, "Número de documento es requerido")
    .refine((val) => {
      // NIT: 14 dígitos + 1 verificador
      if (val.match(/^\d{14}-\d$/)) return true;
      // DUI: 8 dígitos + 1 verificador
      if (val.match(/^\d{8}-\d$/)) return true;
      // Otros formatos (más flexibles)
      return val.length >= 5;
    }, "Formato de documento inválido"),
  nrc: z.string().optional(),
  nombre: z.string().min(1, "Nombre es requerido").max(100),
  codActividad: z.string().optional(),
  descActividad: z.string().optional(),
  direccion: z.object({
    departamento: z.string().min(1, "Departamento es requerido"),
    municipio: z.string().min(1, "Municipio es requerido"),
    complemento: z.string().min(1, "Dirección es requerida"),
  }),
  telefono: z.string().optional(),
  correo: z.string().email("Correo inválido").optional().or(z.literal("")),
});

export const itemFacturaSchema = z.object({
  numItem: z.number().min(1),
  tipoItem: z.enum(["1", "2", "3", "4"]).default("2"),
  cantidad: z.number().min(0.01, "Cantidad debe ser mayor a 0"),
  codigo: z.string().optional(),
  uniMedida: z.number().default(99),
  descripcion: z.string().min(1, "Descripción es requerida"),
  precioUni: z.number().min(0, "Precio debe ser mayor o igual a 0"),
  montoDescu: z.number().default(0),
  ventaNoSuj: z.number().default(0),
  ventaExenta: z.number().default(0),
  ventaGravada: z.number().default(0),
  tributos: z.array(z.string()).optional(),
  psv: z.number().default(0),
  noGravado: z.number().default(0),
  ivaItem: z.number().default(0),
});

export const resumenFacturaSchema = z.object({
  totalNoSuj: z.number().default(0),
  totalExenta: z.number().default(0),
  totalGravada: z.number().default(0),
  subTotalVentas: z.number().default(0),
  descuNoSuj: z.number().default(0),
  descuExenta: z.number().default(0),
  descuGravada: z.number().default(0),
  porcentajeDescuento: z.number().default(0),
  totalDescu: z.number().default(0),
  tributos: z.array(z.object({
    codigo: z.string(),
    descripcion: z.string(),
    valor: z.number(),
  })).optional(),
  subTotal: z.number().default(0),
  ivaRete1: z.number().default(0),
  reteRenta: z.number().default(0),
  montoTotalOperacion: z.number().default(0),
  totalNoGravado: z.number().default(0),
  totalPagar: z.number().default(0),
  totalLetras: z.string().default(""),
  totalIva: z.number().default(0),
  saldoFavor: z.number().default(0),
  condicionOperacion: z.enum(["1", "2", "3"]).default("1"),
  pagos: z.array(z.object({
    codigo: z.string(),
    montoPago: z.number(),
    referencia: z.string().optional(),
    plazo: z.string().optional(),
    periodo: z.number().optional(),
  })).optional(),
  numPagoElectronico: z.string().optional(),
});

export const facturaSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().optional(),
  version: z.number().default(1),
  ambiente: z.enum(["00", "01"]).default("00"),
  tipoDte: z.enum(["01", "03", "05", "06", "07", "08", "09", "11", "14", "15"]).default("01"),
  numeroControl: z.string(),
  codigoGeneracion: z.string(),
  tipoModelo: z.enum(["1", "2"]).default("1"),
  tipoOperacion: z.enum(["1", "2"]).default("1"),
  tipoContingencia: z.string().nullable().optional(),
  motivoContin: z.string().nullable().optional(),
  fecEmi: z.string(),
  horEmi: z.string(),
  tipoMoneda: z.string().default("USD"),
  emisor: emisorSchema,
  receptor: receptorSchema,
  cuerpoDocumento: z.array(itemFacturaSchema),
  resumen: resumenFacturaSchema,
  extension: z.object({
    nombEntrega: z.string().optional(),
    docuEntrega: z.string().optional(),
    nombRecibe: z.string().optional(),
    docuRecibe: z.string().optional(),
    observaciones: z.string().optional(),
    placaVehiculo: z.string().optional(),
  }).optional(),
  apendice: z.array(z.object({
    campo: z.string(),
    etiqueta: z.string(),
    valor: z.string(),
  })).optional(),
  selloRecibido: z.string().nullable().optional(),
  estado: z.enum(["borrador", "generada", "transmitida", "sellada", "anulada"]).default("borrador"),
  createdAt: z.string().optional(),
});

export type Emisor = z.infer<typeof emisorSchema>;
export type Receptor = z.infer<typeof receptorSchema>;
export type ItemFactura = z.infer<typeof itemFacturaSchema>;
export type ResumenFactura = z.infer<typeof resumenFacturaSchema>;
export type Factura = z.infer<typeof facturaSchema>;

export const insertFacturaSchema = facturaSchema.omit({ id: true, createdAt: true });
export type InsertFactura = z.infer<typeof insertFacturaSchema>;

export const DEPARTAMENTOS_EL_SALVADOR = [
  { codigo: "01", nombre: "Ahuachapán" },
  { codigo: "02", nombre: "Santa Ana" },
  { codigo: "03", nombre: "Sonsonate" },
  { codigo: "04", nombre: "Chalatenango" },
  { codigo: "05", nombre: "La Libertad" },
  { codigo: "06", nombre: "San Salvador" },
  { codigo: "07", nombre: "Cuscatlán" },
  { codigo: "08", nombre: "La Paz" },
  { codigo: "09", nombre: "Cabañas" },
  { codigo: "10", nombre: "San Vicente" },
  { codigo: "11", nombre: "Usulután" },
  { codigo: "12", nombre: "San Miguel" },
  { codigo: "13", nombre: "Morazán" },
  { codigo: "14", nombre: "La Unión" },
];

export const TIPOS_DOCUMENTO = [
  { codigo: "36", nombre: "NIT" },
  { codigo: "13", nombre: "DUI" },
  { codigo: "02", nombre: "Carnet de Residente" },
  { codigo: "03", nombre: "Pasaporte" },
  { codigo: "37", nombre: "Otro" },
];

export const TIPOS_DTE = [
  { codigo: "01", nombre: "Factura" },
  { codigo: "03", nombre: "Comprobante de Crédito Fiscal" },
  { codigo: "05", nombre: "Nota de Crédito" },
  { codigo: "06", nombre: "Nota de Débito" },
  { codigo: "07", nombre: "Nota de Remisión" },
  { codigo: "08", nombre: "Comprobante de Liquidación" },
  { codigo: "09", nombre: "Documento Contable de Liquidación" },
  { codigo: "11", nombre: "Factura de Exportación" },
  { codigo: "14", nombre: "Factura Sujeto Excluido" },
  { codigo: "15", nombre: "Comprobante de Donación" },
];

export const CONDICIONES_OPERACION = [
  { codigo: "1", nombre: "Contado" },
  { codigo: "2", nombre: "A crédito" },
  { codigo: "3", nombre: "Otro" },
];

export const FORMAS_PAGO = [
  { codigo: "01", nombre: "Billetes y monedas" },
  { codigo: "02", nombre: "Tarjeta Débito" },
  { codigo: "03", nombre: "Tarjeta Crédito" },
  { codigo: "04", nombre: "Cheque" },
  { codigo: "05", nombre: "Transferencia - Depósito Bancario" },
  { codigo: "06", nombre: "Vales" },
  { codigo: "07", nombre: "Pago a cuenta" },
  { codigo: "08", nombre: "Bitcoin" },
  { codigo: "99", nombre: "Otros" },
];

export const TIPOS_ITEM = [
  { codigo: "1", nombre: "Bienes" },
  { codigo: "2", nombre: "Servicios" },
  { codigo: "3", nombre: "Ambos (Bien y Servicio)" },
  { codigo: "4", nombre: "Otro" },
];

export const UNIDADES_MEDIDA = [
  { codigo: 1, nombre: "Metro" },
  { codigo: 2, nombre: "Yarda" },
  { codigo: 3, nombre: "Vara" },
  { codigo: 4, nombre: "Pie" },
  { codigo: 5, nombre: "Pulgada" },
  { codigo: 6, nombre: "Milímetro" },
  { codigo: 7, nombre: "Centímetro" },
  { codigo: 8, nombre: "Kilómetro" },
  { codigo: 9, nombre: "Metro Cuadrado" },
  { codigo: 10, nombre: "Hectárea" },
  { codigo: 11, nombre: "Metro Cúbico" },
  { codigo: 12, nombre: "Onza" },
  { codigo: 13, nombre: "Libra" },
  { codigo: 14, nombre: "Gramo" },
  { codigo: 15, nombre: "Kilogramo" },
  { codigo: 16, nombre: "Tonelada" },
  { codigo: 17, nombre: "Litro" },
  { codigo: 18, nombre: "Galón" },
  { codigo: 19, nombre: "Barril" },
  { codigo: 20, nombre: "Unidad" },
  { codigo: 21, nombre: "Par" },
  { codigo: 22, nombre: "Docena" },
  { codigo: 23, nombre: "Ciento" },
  { codigo: 24, nombre: "Millar" },
  { codigo: 99, nombre: "Otra" },
];
