import { 
  type User, type InsertUser, type Factura, type InsertFactura, type Emisor, type Tenant,
  type Producto, type InsertProducto, type Certificado, type InsertCertificado,
  users, emisorTable, facturasTable, secuencialControlTable, tenants, facturaItemsTable,
  tenantCredentials, receptoresTable, apiKeys, contingenciaQueueTable, anulacionesTable,
  productosTable, certificadosTable
} from "@shared/schema";
import { randomUUID, createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import { encrypt, decrypt } from "./lib/crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface IStorage {
  // Tenencia
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(nombre: string, slug: string): Promise<Tenant>;
  ensureDefaultTenant(): Promise<Tenant>;
  listTenants(): Promise<Tenant[]>;
  updateTenantStatus(tenantId: string, estado: string): Promise<void>;
  updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<void>;
  deleteTenant(tenantId: string): Promise<void>;
  getSystemMetrics(): Promise<{
    totalEmpresas: number;
    empresasActivas: number;
    totalUsuarios: number;
    totalFacturas: number;
  }>;

  // Credenciales (Certificados)
  getTenantCredentials(tenantId: string): Promise<any | undefined>;
  saveTenantCredentials(tenantId: string, credentials: any): Promise<void>;

  // Usuarios
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<void>;
  updateUserPermissions(userId: string, updates: {
    role?: string;
    sucursales_asignadas?: string[] | null;
    modulos_habilitados?: Record<string, boolean> | null;
  }): Promise<void>;
  listUsersByTenant(tenantId: string): Promise<any[]>;
  deleteUser(userId: string): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  updateUserStatus(userId: string, activo: boolean): Promise<void>;
  updateUserPhone(userId: string, telefono: string): Promise<void>;
  
  // Clientes (Receptores)
  getReceptores(tenantId: string): Promise<any[]>;
  getReceptorByDoc(tenantId: string, numDocumento: string): Promise<any | undefined>;
  upsertReceptor(tenantId: string, receptor: any): Promise<void>;
  updateReceptor(id: string, tenantId: string, updates: any): Promise<any>;
  deleteReceptor(id: string, tenantId: string): Promise<boolean>;

  // Productos / Servicios
  getProductos(tenantId: string): Promise<Producto[]>;
  getProducto(id: string, tenantId: string): Promise<Producto | undefined>;
  createProducto(tenantId: string, producto: InsertProducto): Promise<Producto>;
  updateProducto(id: string, tenantId: string, producto: Partial<InsertProducto>): Promise<Producto | undefined>;
  deleteProducto(id: string, tenantId: string): Promise<boolean>;

  // Certificados Digitales
  getCertificados(tenantId: string): Promise<Certificado[]>;
  getCertificado(id: string, tenantId: string): Promise<Certificado | undefined>;
  createCertificado(tenantId: string, certificado: Partial<InsertCertificado> & { huella: string }): Promise<Certificado>;
  updateCertificado(id: string, tenantId: string, certificado: Partial<Certificado>): Promise<Certificado | undefined>;
  deleteCertificado(id: string, tenantId: string): Promise<boolean>;

  // Emisor (Configuración por Tenant)
  getEmisor(tenantId: string): Promise<Emisor | undefined>;
  saveEmisor(tenantId: string, emisor: Emisor): Promise<Emisor>;
  
  // Facturación (DTEs por Tenant)
  getFacturas(tenantId: string): Promise<Factura[]>;
  getFactura(id: string, tenantId: string): Promise<Factura | undefined>;
  createFactura(tenantId: string, factura: InsertFactura): Promise<Factura>;
  updateFactura(id: string, tenantId: string, factura: Partial<Factura>): Promise<Factura | undefined>;
  deleteFactura(id: string, tenantId: string): Promise<boolean>;
  getNextNumeroControl(tenantId: string, emisorNit: string, tipoDte: string): Promise<string>;
  getFacturaByCodigoGeneracion(codigoGen: string, tenantId: string): Promise<Factura | null>;
  
  // API Keys para integraciones (SIGMA)
  createApiKey(tenantId: string, name: string): Promise<string>;
  validateApiKey(key: string): Promise<{ tenantId: string } | null>;
  listApiKeys(tenantId: string): Promise<any[]>;
  deleteApiKey(id: string, tenantId: string): Promise<void>;

  // Contingencia (Cola de DTEs cuando MH está caído)
  addToContingenciaQueue(tenantId: string, facturaId: string, codigoGeneracion: string): Promise<void>;
  getContingenciaQueue(tenantId: string, estado?: string): Promise<any[]>;
  updateContingenciaStatus(codigoGeneracion: string, estado: string, error?: string): Promise<void>;
  marcarContingenciaCompleta(codigoGeneracion: string): Promise<void>;

  // Anulaciones (Invalidación de DTEs)
  crearAnulacion(tenantId: string, facturaId: string, codigoGeneracion: string, motivo: string, usuarioId: string, observaciones?: string): Promise<void>;
  getAnulacion(codigoGeneracion: string, tenantId: string): Promise<any | null>;
  getAnulacionesPendientes(tenantId: string): Promise<any[]>;
  updateAnulacionStatus(codigoGeneracion: string, estado: string, selloAnulacion?: string, respuestaMH?: any, error?: string): Promise<void>;
  getHistoricoAnulaciones(tenantId: string, limit?: number): Promise<any[]>;

  initialize(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async initialize(): Promise<void> {
    await this.ensureDefaultTenant();
  }

  async ensureDefaultTenant(): Promise<Tenant> {
    let [tenant] = await db.select().from(tenants).where(eq(tenants.slug, "default")).limit(1);
    if (!tenant) {
      [tenant] = await db.insert(tenants).values({
        nombre: "Empresa por Defecto",
        slug: "default",
      }).returning();
    }
    return tenant;
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant;
  }

  async createTenant(nombre: string, slug: string): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values({ nombre, slug }).returning();
    return tenant;
  }

  async listTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async updateTenantStatus(tenantId: string, estado: string): Promise<void> {
    await db.update(tenants).set({ estado }).where(eq(tenants.id, tenantId));
  }

  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<void> {
    await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));
  }

  async deleteTenant(tenantId: string): Promise<void> {
    // Eliminar en cascada: usuarios, facturas, productos, etc.
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(facturasTable).where(eq(facturasTable.tenantId, tenantId));
    await db.delete(productosTable).where(eq(productosTable.tenantId, tenantId));
    await db.delete(certificadosTable).where(eq(certificadosTable.tenantId, tenantId));
    await db.delete(receptoresTable).where(eq(receptoresTable.tenantId, tenantId));
    await db.delete(tenantCredentials).where(eq(tenantCredentials.tenantId, tenantId));
    await db.delete(anulacionesTable).where(eq(anulacionesTable.tenantId, tenantId));
    await db.delete(contingenciaQueueTable).where(eq(contingenciaQueueTable.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }

  async getSystemMetrics(): Promise<{
    totalEmpresas: number;
    empresasActivas: number;
    totalUsuarios: number;
    totalFacturas: number;
  }> {
    const [empresasCount] = await db.select({ count: sql<number>`count(*)::int` }).from(tenants);
    const [empresasActivasCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(eq(tenants.estado, "activo"));
    const [usuariosCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [facturasCount] = await db.select({ count: sql<number>`count(*)::int` }).from(facturasTable);

    return {
      totalEmpresas: empresasCount.count || 0,
      empresasActivas: empresasActivasCount.count || 0,
      totalUsuarios: usuariosCount.count || 0,
      totalFacturas: facturasCount.count || 0,
    };
  }

  async getTenantCredentials(tenantId: string): Promise<any | undefined> {
    const [creds] = await db.select().from(tenantCredentials).where(eq(tenantCredentials.tenantId, tenantId)).limit(1);
    if (!creds) return undefined;

    return {
      ...creds,
      mhPass: decrypt(creds.mhPassEnc),
      certificadoP12: decrypt(creds.certificadoP12Enc),
      certificadoPass: decrypt(creds.certificadoPassEnc),
    };
  }

  async saveTenantCredentials(tenantId: string, creds: any): Promise<void> {
    await db.delete(tenantCredentials).where(eq(tenantCredentials.tenantId, tenantId));
    await db.insert(tenantCredentials).values({
      tenantId,
      mhUsuario: creds.mhUsuario,
      mhPassEnc: encrypt(creds.mhPass),
      certificadoP12Enc: encrypt(creds.certificadoP12),
      certificadoPassEnc: encrypt(creds.certificadoPass),
      ambiente: creds.ambiente || "pruebas",
      validoHasta: creds.validoHasta,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    let tId = insertUser.tenantId;
    if (!tId) {
      const def = await this.ensureDefaultTenant();
      tId = def.id;
    }
    const [user] = await db.insert(users).values({ ...insertUser, tenantId: tId }).returning();
    return user;
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  }

  async updateUserPermissions(
    userId: string,
    updates: {
      role?: string;
      sucursales_asignadas?: string[] | null;
      modulos_habilitados?: Record<string, boolean> | null;
    }
  ): Promise<void> {
    const updateData: any = {};
    if (updates.role) updateData.role = updates.role;
    if (updates.sucursales_asignadas !== undefined) {
      updateData.sucursales_asignadas = updates.sucursales_asignadas;
    }
    if (updates.modulos_habilitados !== undefined) {
      updateData.modulos_habilitados = updates.modulos_habilitados;
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));
  }

  async listUsersByTenant(tenantId: string): Promise<any[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(desc(users.createdAt));
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ password: passwordHash }).where(eq(users.id, userId));
  }

  async updateUserStatus(userId: string, activo: boolean): Promise<void> {
    await db.update(users).set({ activo }).where(eq(users.id, userId));
  }

  async updateUserPhone(userId: string, telefono: string): Promise<void> {
    await db.update(users).set({ telefono }).where(eq(users.id, userId));
  }

  async getReceptores(tenantId: string): Promise<any[]> {
    return await db.select().from(receptoresTable).where(eq(receptoresTable.tenantId, tenantId)).orderBy(desc(receptoresTable.createdAt));
  }

  async getReceptorByDoc(tenantId: string, numDocumento: string): Promise<any | undefined> {
    const [row] = await db.select().from(receptoresTable)
      .where(and(eq(receptoresTable.tenantId, tenantId), eq(receptoresTable.numDocumento, numDocumento)));
    return row;
  }

  async upsertReceptor(tenantId: string, r: any): Promise<void> {
    const existing = await this.getReceptorByDoc(tenantId, r.numDocumento);
    if (existing) {
      await db.update(receptoresTable)
        .set({
          nombre: r.nombre,
          tipoDocumento: r.tipoDocumento,
          nrc: r.nrc || null,
          codActividad: r.codActividad || null,
          descActividad: r.descActividad || null,
          direccion: r.direccion,
          telefono: r.telefono || null,
          correo: r.correo || null,
        })
        .where(eq(receptoresTable.id, existing.id));
    } else {
      await db.insert(receptoresTable).values({
        tenantId,
        tipoDocumento: r.tipoDocumento,
        numDocumento: r.numDocumento,
        nombre: r.nombre,
        nrc: r.nrc || null,
        codActividad: r.codActividad || null,
        descActividad: r.descActividad || null,
        direccion: r.direccion,
        telefono: r.telefono || null,
        correo: r.correo || null,
      });
    }
  }

  async updateReceptor(id: string, tenantId: string, updates: any): Promise<any> {
    const [row] = await db.update(receptoresTable)
      .set(updates)
      .where(and(eq(receptoresTable.id, id), eq(receptoresTable.tenantId, tenantId)))
      .returning();
    return row;
  }

  async deleteReceptor(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(receptoresTable)
      .where(and(eq(receptoresTable.id, id), eq(receptoresTable.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  // === MÉTODOS DE PRODUCTOS ===

  async getProductos(tenantId: string): Promise<Producto[]> {
    return await db.select().from(productosTable)
      .where(eq(productosTable.tenantId, tenantId))
      .orderBy(desc(productosTable.createdAt));
  }

  async getProducto(id: string, tenantId: string): Promise<Producto | undefined> {
    const [row] = await db.select().from(productosTable)
      .where(and(eq(productosTable.id, id), eq(productosTable.tenantId, tenantId)));
    return row;
  }

  async createProducto(tenantId: string, p: InsertProducto): Promise<Producto> {
    const [row] = await db.insert(productosTable).values({
      ...p,
      tenantId,
      precioUnitario: p.precioUnitario.toString(),
    }).returning();
    return row;
  }

  async updateProducto(id: string, tenantId: string, updates: Partial<InsertProducto>): Promise<Producto | undefined> {
    const data: any = { ...updates, updatedAt: new Date() };
    if (updates.precioUnitario !== undefined) {
      data.precioUnitario = updates.precioUnitario.toString();
    }

    const [row] = await db.update(productosTable)
      .set(data)
      .where(and(eq(productosTable.id, id), eq(productosTable.tenantId, tenantId)))
      .returning();
    return row;
  }

  async deleteProducto(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(productosTable)
      .where(and(eq(productosTable.id, id), eq(productosTable.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  // ============================================
  // CERTIFICADOS DIGITALES
  // ============================================

  async getCertificados(tenantId: string): Promise<Certificado[]> {
    try {
      return await db.select().from(certificadosTable)
        .where(eq(certificadosTable.tenantId, tenantId))
        .orderBy(desc(certificadosTable.createdAt));
    } catch (error) {
      console.error("Error in storage.getCertificados:", error);
      throw error;
    }
  }

  async getCertificado(id: string, tenantId: string): Promise<Certificado | undefined> {
    const [row] = await db.select().from(certificadosTable)
      .where(and(eq(certificadosTable.id, id), eq(certificadosTable.tenantId, tenantId)));
    return row;
  }

  async createCertificado(tenantId: string, c: Partial<InsertCertificado> & { huella: string }): Promise<Certificado> {
    const [row] = await db.insert(certificadosTable).values({
      ...c,
      tenantId,
      diasParaExpiracion: c.validoHasta 
        ? Math.floor((new Date(c.validoHasta).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : undefined,
    } as any).returning();
    return row;
  }

  async updateCertificado(id: string, tenantId: string, updates: Partial<Certificado>): Promise<Certificado | undefined> {
    const data: any = { ...updates, updatedAt: new Date() };
    
    // Recalcular días para expiración si cambió la fecha
    if (updates.validoHasta) {
      data.diasParaExpiracion = Math.floor(
        (new Date(updates.validoHasta).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    const [row] = await db.update(certificadosTable)
      .set(data)
      .where(and(eq(certificadosTable.id, id), eq(certificadosTable.tenantId, tenantId)))
      .returning();
    return row;
  }

  async deleteCertificado(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(certificadosTable)
      .where(and(eq(certificadosTable.id, id), eq(certificadosTable.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  async getEmisor(tenantId: string): Promise<Emisor | undefined> {
    const [row] = await db.select().from(emisorTable).where(eq(emisorTable.tenantId, tenantId)).limit(1);
    return row ? (row.data as Emisor) : undefined;
  }

  async saveEmisor(tenantId: string, emisor: Emisor): Promise<Emisor> {
    await db.delete(emisorTable).where(eq(emisorTable.tenantId, tenantId));
    await db.insert(emisorTable).values({
      id: randomUUID(),
      tenantId: tenantId,
      data: emisor,
    });
    return emisor;
  }

  async getFacturas(tenantId: string): Promise<Factura[]> {
    const rows = await db.select().from(facturasTable)
      .where(eq(facturasTable.tenantId, tenantId))
      .orderBy(desc(facturasTable.createdAt));
    return rows.map(row => row.data as Factura);
  }

  async getFactura(id: string, tenantId: string): Promise<Factura | undefined> {
    const [row] = await db.select().from(facturasTable)
      .where(and(eq(facturasTable.id, id), eq(facturasTable.tenantId, tenantId)));
    return row ? (row.data as Factura) : undefined;
  }

  async createFactura(tenantId: string, insertFactura: InsertFactura & { externalId?: string }): Promise<Factura> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const factura: Factura = { ...insertFactura, id, createdAt, tenantId, externalId: insertFactura.externalId };
    
    await db.transaction(async (tx) => {
      await tx.insert(facturasTable).values({
        id,
        tenantId,
        externalId: insertFactura.externalId || null,
        data: factura,
        createdAt: new Date(createdAt),
        fecEmi: insertFactura.fecEmi,
        estado: insertFactura.estado || "borrador",
        codigoGeneracion: insertFactura.codigoGeneracion,
      });

      if (insertFactura.cuerpoDocumento && insertFactura.cuerpoDocumento.length > 0) {
        const items = insertFactura.cuerpoDocumento.map((item, idx) => ({
          facturaId: id,
          numItem: item.numItem || idx + 1,
          tipoItem: item.tipoItem,
          cantidad: item.cantidad.toString(),
          codigo: item.codigo,
          descripcion: item.descripcion,
          precioUni: item.precioUni.toString(),
          ventaNoSuj: (item.ventaNoSuj || 0).toString(),
          ventaExenta: (item.ventaExenta || 0).toString(),
          ventaGravada: (item.ventaGravada || 0).toString(),
          ivaItem: (item.ivaItem || 0).toString(),
          tributos: item.tributos || null,
        }));
        await tx.insert(facturaItemsTable).values(items);
      }
    });
    
    return factura;
  }

  async updateFactura(id: string, tenantId: string, updates: Partial<Factura>): Promise<Factura | undefined> {
    const current = await this.getFactura(id, tenantId);
    if (!current) return undefined;
    
    const updated = { ...current, ...updates };
    
    await db.update(facturasTable)
      .set({ 
        data: updated,
        estado: updated.estado,
        selloRecibido: updated.selloRecibido,
      })
      .where(and(eq(facturasTable.id, id), eq(facturasTable.tenantId, tenantId)));
      
    return updated;
  }

  async deleteFactura(id: string, tenantId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx.delete(facturaItemsTable).where(eq(facturaItemsTable.facturaId, id));
      const result = await tx.delete(facturasTable)
        .where(and(eq(facturasTable.id, id), eq(facturasTable.tenantId, tenantId)))
        .returning();
      return result.length > 0;
    });
  }

  async getNextNumeroControl(tenantId: string, emisorNit: string, tipoDte: string): Promise<string> {
    return await db.transaction(async (tx) => {
      let [record] = await tx
        .select()
        .from(secuencialControlTable)
        .where(
          and(
            eq(secuencialControlTable.tenantId, tenantId),
            eq(secuencialControlTable.emisorNit, emisorNit),
            eq(secuencialControlTable.tipoDte, tipoDte)
          )
        );

      let newSecuencial = 1;

      if (!record) {
        [record] = await tx
          .insert(secuencialControlTable)
          .values({
            tenantId,
            emisorNit,
            tipoDte,
            secuencial: 1,
          })
          .returning();
      } else {
        newSecuencial = record.secuencial + 1;
        [record] = await tx
          .update(secuencialControlTable)
          .set({
            secuencial: newSecuencial,
            fechaActualizacion: new Date(),
          })
          .where(eq(secuencialControlTable.id, record.id))
          .returning();
      }

      const prefix = String(tipoDte).padStart(3, '0');
      const suffix = String(newSecuencial).padStart(18, '0');
      const numeroControl = `${prefix}-${suffix}`;

      await tx.update(secuencialControlTable)
        .set({ ultimoNumeroControl: numeroControl })
        .where(eq(secuencialControlTable.id, record.id));

      return numeroControl;
    });
  }

  async getFacturaByCodigoGeneracion(codigoGen: string, tenantId: string): Promise<Factura | null> {
    const [row] = await db
      .select()
      .from(facturasTable)
      .where(and(
        eq(facturasTable.codigoGeneracion, codigoGen),
        eq(facturasTable.tenantId, tenantId)
      ))
      .limit(1);
      
    return row ? (row.data as Factura) : null;
  }

  // Integración SIGMA: Manejo de API Keys
  async createApiKey(tenantId: string, name: string): Promise<string> {
    const rawKey = `fx_live_${randomUUID().replace(/-/g, "")}`;
    const hashedKey = createHash("sha256").update(rawKey).digest("hex");
    
    await db.insert(apiKeys).values({
      tenantId,
      name,
      key: hashedKey, // Guardamos el hash
    });
    return rawKey; // Retornamos la key original al usuario (SOLO UNA VEZ)
  }

  async validateApiKey(key: string): Promise<{ tenantId: string } | null> {
    const hashedKey = createHash("sha256").update(key).digest("hex");
    
    const [row] = await db.select().from(apiKeys).where(and(eq(apiKeys.key, hashedKey), eq(apiKeys.active, true))).limit(1);
    if (!row) return null;

    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
    return { tenantId: row.tenantId };
  }

  async listApiKeys(tenantId: string): Promise<any[]> {
    return await db.select().from(apiKeys).where(eq(apiKeys.tenantId, tenantId)).orderBy(desc(apiKeys.createdAt));
  }

  async deleteApiKey(id: string, tenantId: string): Promise<void> {
    await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));
  }

  // === MÉTODOS DE CONTINGENCIA ===

  async addToContingenciaQueue(tenantId: string, facturaId: string, codigoGeneracion: string): Promise<void> {
    await db.insert(contingenciaQueueTable).values({
      tenantId,
      facturaId,
      codigoGeneracion,
      estado: "pendiente",
      intentosFallidos: 0,
      fechaIngreso: new Date(),
    });
  }

  async getContingenciaQueue(tenantId: string, estado?: string): Promise<any[]> {
    let query: any = db.select().from(contingenciaQueueTable).where(eq(contingenciaQueueTable.tenantId, tenantId));
    
    if (estado) {
      query = query.where(eq(contingenciaQueueTable.estado, estado));
    }

    return await query;
  }

  async updateContingenciaStatus(codigoGeneracion: string, estado: string, error?: string): Promise<void> {
    const updates: any = {
      estado,
      fechaIntento: new Date(),
    };

    if (error) {
      updates.ultimoError = error;
    }

    const records = await db.select().from(contingenciaQueueTable)
      .where(eq(contingenciaQueueTable.codigoGeneracion, codigoGeneracion))
      .limit(1);

    if (records && records.length > 0 && records[0]) {
      const record = records[0] as any;
      updates.intentosFallidos = (record.intentosFallidos ?? 0) + 1;
    }

    await db.update(contingenciaQueueTable)
      .set(updates)
      .where(eq(contingenciaQueueTable.codigoGeneracion, codigoGeneracion));
  }

  async marcarContingenciaCompleta(codigoGeneracion: string): Promise<void> {
    await db.update(contingenciaQueueTable)
      .set({
        estado: "completado",
        fechaCompletado: new Date(),
      })
      .where(eq(contingenciaQueueTable.codigoGeneracion, codigoGeneracion));
  }

  // === MÉTODOS DE ANULACIÓN ===

  async crearAnulacion(tenantId: string, facturaId: string, codigoGeneracion: string, motivo: string, usuarioId: string, observaciones?: string): Promise<void> {
    await db.insert(anulacionesTable).values({
      tenantId,
      facturaId,
      codigoGeneracion,
      motivo,
      observaciones: observaciones || "",
      estado: "pendiente",
      usuarioAnulo: usuarioId,
      fechaAnulo: new Date(),
      intentosFallidos: 0,
    });
  }

  async getAnulacion(codigoGeneracion: string, tenantId: string): Promise<any | null> {
    const results = await db.select().from(anulacionesTable)
      .where(and(
        eq(anulacionesTable.codigoGeneracion, codigoGeneracion),
        eq(anulacionesTable.tenantId, tenantId)
      ))
      .limit(1);

    return results && results.length > 0 ? results[0] : null;
  }

  async getAnulacionesPendientes(tenantId: string): Promise<any[]> {
    return await db.select().from(anulacionesTable)
      .where(and(
        eq(anulacionesTable.tenantId, tenantId),
        eq(anulacionesTable.estado, "pendiente")
      ));
  }

  async updateAnulacionStatus(codigoGeneracion: string, estado: string, selloAnulacion?: string, respuestaMH?: any, error?: string): Promise<void> {
    const updates: any = {
      estado,
      fechaProcesso: new Date(),
    };

    if (selloAnulacion) updates.selloAnulacion = selloAnulacion;
    if (respuestaMH) updates.respuestaMH = respuestaMH;
    if (error) {
      updates.ultimoError = error;
      const record = await db.select().from(anulacionesTable)
        .where(eq(anulacionesTable.codigoGeneracion, codigoGeneracion))
        .limit(1);
      if (record && record.length > 0 && record[0]) {
        const r = record[0] as any;
        updates.intentosFallidos = (r.intentosFallidos ?? 0) + 1;
      }
    }

    await db.update(anulacionesTable)
      .set(updates)
      .where(eq(anulacionesTable.codigoGeneracion, codigoGeneracion));
  }

  async getHistoricoAnulaciones(tenantId: string, limit?: number): Promise<any[]> {
    let query: any = db.select().from(anulacionesTable)
      .where(eq(anulacionesTable.tenantId, tenantId))
      .orderBy(desc(anulacionesTable.fechaAnulo));
    
    if (limit) query = query.limit(limit);
    
    return await query;
  }
}

export const storage = new DatabaseStorage();
