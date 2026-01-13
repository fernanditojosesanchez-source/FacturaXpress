import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, jsonb, serial, unique, uuid, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- TABLAS PARA MULTI-TENANCY ---

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nombre: text("nombre").notNull(),
  slug: text("slug").unique().notNull(),
  tipo: text("tipo").default("clinic"), // clinic, hospital, lab, store
  estado: text("estado").default("activo"),
  origen: text("origen"), // null = directo, 'sigma' = viene de Sigma ERP
  modules: jsonb("modules").default({}), // Feature flags: { inventory: false, accounting: true }
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

// --- TABLA DE CERTIFICADOS DIGITALES ---

export const certificadosTable = pgTable("certificados", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  nombre: text("nombre").notNull(), // Nombre amigable: "Certificado 2024", "Cert Principal", etc.
  archivo: text("archivo").notNull(), // Contenido del P12 en base64 (encriptado)
  huella: text("huella").notNull(), // Fingerprint/Huella del certificado para validación
  algoritmo: text("algoritmo").default("RSA"), // RSA, ECDSA, etc.
  emisor: text("emisor"), // Información del emisor del certificado
  sujeto: text("sujeto"), // Información del sujeto (puede ser NIT)
  validoDesde: timestamp("valido_desde"), // Fecha de inicio de validez
  validoHasta: timestamp("valido_hasta"), // Fecha de expiración
  diasParaExpiracion: integer("dias_para_expiracion"), // Calculado, para alertas
  contrasena: text("contrasena_enc"), // Contraseña encriptada
  estado: text("estado").default("pendiente"), // pendiente, validado, activo, expirado, revocado
  activo: boolean("activo").default(false), // Si es el certificado activo/principal
  esProductivo: boolean("es_productivo").default(false), // Si es para ambiente productivo o pruebas
  certificadoValido: boolean("certificado_valido").default(false), // Validado correctamente
  ultimaValidacion: timestamp("ultima_validacion"),
  erroresValidacion: jsonb("errores_validacion"), // { "error1": "descripción", ... }
  urlDescarga: text("url_descarga"), // URL temporal para descargar (si aplica)
  creadoPor: varchar("creado_por").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unq_huella: unique().on(t.tenantId, t.huella),
  idx_tenantId: index("idx_certificados_tenantId").on(t.tenantId),
  idx_estado: index("idx_certificados_estado").on(t.estado),
  idx_activo: index("idx_certificados_activo").on(t.activo),
  idx_tenant_activo: index("idx_certificados_tenant_activo").on(t.tenantId, t.activo),
}));

// --- TABLAS DE NEGOCIO ACTUALIZADAS ---

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  nombre: text("nombre"),
  password: text("password").notNull(),
  
  // Sistema de roles
  role: text("role").notNull().default("cashier"),
  // Roles disponibles:
  //   'super_admin'      - Administrador SaaS (FacturaXpress)
  //   'tenant_admin'     - Dueño/admin de la empresa
  //   'manager'          - Gerente de sucursal
  //   'cashier'          - Cajero/facturador
  //   'accountant'       - Contador (solo lectura + reportes)
  //   'sigma_readonly'   - Usuario Sigma básico (solo consulta)
  
  // Restricciones por sucursal (para manager/cashier)
  sucursales_asignadas: jsonb("sucursales_asignadas").default(null),
  // Formato: ["uuid-sucursal-1", "uuid-sucursal-2"] o null si tiene acceso a todas
  
  // Controles de módulos personalizados por usuario
  // Nota: también hereda de tenants.modules, pero puede tener overrides
  modulos_habilitados: jsonb("modulos_habilitados").default(null),
  // Ejemplo: {
  //   "inventario": true,
  //   "facturacion": true,
  //   "reportes": true,
  //   "contabilidad": true,
  //   "multi_sucursal": true
  // }
  // null = heredar de tenant
  
  // Datos de contacto
  telefono: text("telefono"),
  
  // Estado de cuenta
  emailVerified: boolean("email_verified").default(false),
  accountLocked: boolean("account_locked").default(false),
  lockUntil: timestamp("lock_until"),
  activo: boolean("activo").default(true),
  
  // Auditoría
  ultimo_acceso: timestamp("ultimo_acceso"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  idx_tenant: index("idx_users_tenant").on(t.tenantId),
  idx_role: index("idx_users_role").on(t.role),
  idx_activo: index("idx_users_activo").on(t.activo),
  idx_tenant_role: index("idx_users_tenant_role").on(t.tenantId, t.role),
}));

export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  ipAddress: text("ip_address").notNull(),
  success: boolean("success").notNull(),
  userAgent: text("user_agent"),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // login, logout, login_failed, password_change, etc.
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emisorTable = pgTable("emisor", {
  id: text("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  data: jsonb("data").notNull(),
});

export const receptoresTable = pgTable("receptores", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  tipoDocumento: text("tipo_documento").notNull(), // 36, 13, etc.
  numDocumento: text("num_documento").notNull(),
  nombre: text("nombre").notNull(),
  nrc: text("nrc"),
  codActividad: text("cod_actividad"),
  descActividad: text("desc_actividad"),
  direccion: jsonb("direccion").notNull(),
  telefono: text("telefono"),
  correo: text("correo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  unq_doc: unique().on(t.tenantId, t.numDocumento),
  idx_tenantId: index("idx_receptores_tenantId").on(t.tenantId),
  idx_numDocumento: index("idx_receptores_numDocumento").on(t.numDocumento),
  idx_tenant_numDoc: index("idx_receptores_tenant_numDoc").on(t.tenantId, t.numDocumento),
}));

export const facturasTable = pgTable("facturas", {
  id: text("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  externalId: text("external_id"), // ID de referencia en SIGMA (Clinic/Hosp/Lab)
  data: jsonb("data").notNull(), // El DTE completo enviado (auditoría)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  fecEmi: text("fec_emi").notNull(),
  estado: text("estado").notNull().default("borrador"), // borrador, generada, transmitida, sellada, anulada
  codigoGeneracion: text("codigo_generacion").unique(),
  selloRecibido: text("sello_recibido"),
}, (t) => ({
  idx_tenantId: index("idx_facturas_tenantId").on(t.tenantId),
  idx_estado: index("idx_facturas_estado").on(t.estado),
  idx_fecEmi: index("idx_facturas_fecEmi").on(t.fecEmi),
  idx_tenant_estado: index("idx_facturas_tenant_estado").on(t.tenantId, t.estado),
}));

// --- COLA DE CONTINGENCIA (Para DTEs cuando MH está caído) ---

export const contingenciaQueueTable = pgTable("contingencia_queue", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  facturaId: text("factura_id").references(() => facturasTable.id).notNull(),
  codigoGeneracion: text("codigo_generacion").notNull(),
  estado: text("estado").notNull().default("pendiente"), // pendiente, procesando, completado, error
  intentosFallidos: integer("intentos_fallidos").default(0),
  ultimoError: text("ultimo_error"),
  fechaIngreso: timestamp("fecha_ingreso").notNull().defaultNow(),
  fechaIntento: timestamp("fecha_intento"),
  fechaCompletado: timestamp("fecha_completado"),
}, (t) => ({
  unq: unique().on(t.tenantId, t.codigoGeneracion),
}));

// --- HISTÓRICO DE ANULACIONES (Para invalidación de DTEs) ---

export const anulacionesTable = pgTable("anulaciones", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  facturaId: text("factura_id").references(() => facturasTable.id).notNull(),
  codigoGeneracion: text("codigo_generacion").notNull(),
  motivo: text("motivo").notNull(), // 01-Anulacion por error, 02-Anulacion por contingencia, 03-Anulacion por cambio de operacion, 04-Anulacion por cambio de referencia, 05-Anulacion por cambio de datos
  observaciones: text("observaciones"),
  estado: text("estado").notNull().default("pendiente"), // pendiente, procesando, aceptado, rechazado, error
  selloAnulacion: text("sello_anulacion"), // Sello del MH para la anulación
  jwsFirmado: text("jws_firmado"), // Documento firmado enviado al MH
  respuestaMH: jsonb("respuesta_mh"), // Respuesta completa del MH
  usuarioAnulo: varchar("usuario_anulo").references(() => users.id),
  fechaAnulo: timestamp("fecha_anulo").notNull().defaultNow(),
  fechaProcesso: timestamp("fecha_proceso"),
  ultimoError: text("ultimo_error"),
  intentosFallidos: integer("intentos_fallidos").default(0),
}, (t) => ({
  unq: unique().on(t.tenantId, t.codigoGeneracion),
}));

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  key: text("key").unique().notNull(), // API Key (formato: fx_live_...)
  name: text("name").notNull(), // Ej: "SIGMA Clinic Integration"
  active: boolean("active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export const productosTable = pgTable("productos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  codigo: text("codigo"), // Código interno o de barras
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  precioUnitario: decimal("precio_unitario", { precision: 12, scale: 6 }).notNull(),
  uniMedida: integer("uni_medida").notNull().default(20), // Default: Unidad
  tipoItem: text("tipo_item").notNull().default("2"), // Default: Servicio
  activo: boolean("activo").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  idx_tenantId: index("idx_productos_tenantId").on(t.tenantId),
  idx_codigo: index("idx_productos_codigo").on(t.codigo),
  idx_activo: index("idx_productos_activo").on(t.activo),
  idx_tenant_activo: index("idx_productos_tenant_activo").on(t.tenantId, t.activo),
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
  externalId: z.string().nullable().optional(),
  version: z.number().default(1),
  ambiente: z.enum(["00", "01"]).default("00"),
  tipoDte: z.enum(["01", "03", "05", "06", "07", "08", "09", "11", "14", "15"]).default("01"),
  numeroControl: z.string().optional(),
  codigoGeneracion: z.string().optional(),
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

// --- PRODUCTOS ---
export const productoSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().optional(),
  codigo: z.string().optional().nullable(),
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().nullable(),
  precioUnitario: z.coerce.number().min(0, "El precio debe ser mayor o igual a 0"),
  uniMedida: z.coerce.number().default(20),
  tipoItem: z.enum(["1", "2", "3", "4"]).default("2"),
  activo: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const insertProductoSchema = productoSchema.omit({ id: true, tenantId: true, createdAt: true, updatedAt: true });
export type Producto = typeof productosTable.$inferSelect;
export type InsertProducto = z.infer<typeof insertProductoSchema>;

// --- CERTIFICADOS ---
export const certificadoSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().optional(),
  nombre: z.string().min(1, "Nombre es requerido"),
  archivo: z.string().min(1, "Archivo es requerido"),
  huella: z.string().min(1, "Huella del certificado es requerida"),
  algoritmo: z.string().default("RSA"),
  emisor: z.string().optional(),
  sujeto: z.string().optional(),
  validoDesde: z.date().optional(),
  validoHasta: z.date().optional(),
  diasParaExpiracion: z.number().optional(),
  contrasena: z.string().min(1, "Contraseña es requerida"),
  estado: z.enum(["pendiente", "validado", "activo", "expirado", "revocado"]).default("pendiente"),
  activo: z.boolean().default(false),
  esProductivo: z.boolean().default(false),
  certificadoValido: z.boolean().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const insertCertificadoSchema = certificadoSchema.omit({ 
  id: true, 
  tenantId: true, 
  createdAt: true, 
  updatedAt: true,
  huella: true, // Se calcula
  diasParaExpiracion: true, // Se calcula
  ultimaValidacion: true,
  erroresValidacion: true,
  certificadoValido: true,
});

export type Certificado = typeof certificadosTable.$inferSelect;
export type InsertCertificado = z.infer<typeof insertCertificadoSchema>;

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
