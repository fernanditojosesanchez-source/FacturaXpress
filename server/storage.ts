import { 
  type User, type InsertUser, type Factura, type InsertFactura, type Emisor, type Tenant,
  users, emisorTable, facturasTable, secuencialControlTable, tenants, facturaItemsTable,
  tenantCredentials, receptoresTable, apiKeys, contingenciaQueueTable, anulacionesTable
} from "@shared/schema";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
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

  // Credenciales (Certificados)
  getTenantCredentials(tenantId: string): Promise<any | undefined>;
  saveTenantCredentials(tenantId: string, credentials: any): Promise<void>;

  // Usuarios
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<void>;
  
  // Clientes (Receptores)
  getReceptores(tenantId: string): Promise<any[]>;
  getReceptorByDoc(tenantId: string, numDocumento: string): Promise<any | undefined>;
  upsertReceptor(tenantId: string, receptor: any): Promise<void>;

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
    const key = `fx_live_${randomUUID().replace(/-/g, "")}`;
    await db.insert(apiKeys).values({
      tenantId,
      name,
      key: key, // En un sistema real, aquí guardaríamos el hash (ej. bcrypt), pero para simplicidad usaremos la key directa o encriptada.
    });
    return key;
  }

  async validateApiKey(key: string): Promise<{ tenantId: string } | null> {
    const [row] = await db.select().from(apiKeys).where(and(eq(apiKeys.key, key), eq(apiKeys.active, true))).limit(1);
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
    try {
      await db.insert(contingenciaQueueTable).values({
        tenantId,
        facturaId,
        codigoGeneracion,
        estado: "pendiente",
        intentosFallidos: 0,
        fechaIngreso: new Date(),
      });
      console.log(`[Contingencia] DTE ${codigoGeneracion} agregado a cola`);
    } catch (error) {
      console.error("[Contingencia] Error al agregar a cola:", error);
      throw error;
    }
  }

  async getContingenciaQueue(tenantId: string, estado?: string): Promise<any[]> {
    try {
      let query: any = db.select().from(contingenciaQueueTable).where(eq(contingenciaQueueTable.tenantId, tenantId));
      
      if (estado) {
        query = query.where(eq(contingenciaQueueTable.estado, estado));
      }

      return await query;
    } catch (error) {
      console.error("[Contingencia] Error al obtener cola:", error);
      return [];
    }
  }

  async updateContingenciaStatus(codigoGeneracion: string, estado: string, error?: string): Promise<void> {
    try {
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

      console.log(`[Contingencia] DTE ${codigoGeneracion} actualizado a estado: ${estado}`);
    } catch (error) {
      console.error("[Contingencia] Error al actualizar estado:", error);
      throw error;
    }
  }

  async marcarContingenciaCompleta(codigoGeneracion: string): Promise<void> {
    try {
      await db.update(contingenciaQueueTable)
        .set({
          estado: "completado",
          fechaCompletado: new Date(),
        })
        .where(eq(contingenciaQueueTable.codigoGeneracion, codigoGeneracion));

      console.log(`[Contingencia] DTE ${codigoGeneracion} marcado como completado`);
    } catch (error) {
      console.error("[Contingencia] Error al marcar como completado:", error);
      throw error;
    }
  }

  // === MÉTODOS DE ANULACIÓN ===

  async crearAnulacion(tenantId: string, facturaId: string, codigoGeneracion: string, motivo: string, usuarioId: string, observaciones?: string): Promise<void> {
    try {
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
      console.log(`[Anulación] DTE ${codigoGeneracion} creado para anular`);
    } catch (error) {
      console.error("[Anulación] Error al crear anulación:", error);
      throw error;
    }
  }

  async getAnulacion(codigoGeneracion: string, tenantId: string): Promise<any | null> {
    try {
      const results = await db.select().from(anulacionesTable)
        .where(and(
          eq(anulacionesTable.codigoGeneracion, codigoGeneracion),
          eq(anulacionesTable.tenantId, tenantId)
        ))
        .limit(1);

      return results && results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error("[Anulación] Error al obtener anulación:", error);
      return null;
    }
  }

  async getAnulacionesPendientes(tenantId: string): Promise<any[]> {
    try {
      return await db.select().from(anulacionesTable)
        .where(and(
          eq(anulacionesTable.tenantId, tenantId),
          eq(anulacionesTable.estado, "pendiente")
        ));
    } catch (error) {
      console.error("[Anulación] Error al obtener pendientes:", error);
      return [];
    }
  }

  async updateAnulacionStatus(codigoGeneracion: string, estado: string, selloAnulacion?: string, respuestaMH?: any, error?: string): Promise<void> {
    try {
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

      console.log(`[Anulación] DTE ${codigoGeneracion} actualizado a estado: ${estado}`);
    } catch (error) {
      console.error("[Anulación] Error al actualizar estado:", error);
      throw error;
    }
  }

  async getHistoricoAnulaciones(tenantId: string, limit?: number): Promise<any[]> {
    try {
      let query: any = db.select().from(anulacionesTable)
        .where(eq(anulacionesTable.tenantId, tenantId))
        .orderBy(desc(anulacionesTable.fechaAnulo));
      
      if (limit) query = query.limit(limit);
      
      return await query;
    } catch (error) {
      console.error("[Anulación] Error al obtener histórico:", error);
      return [];
    }
  }
}

// Implementación de fallback para SQLite
export class SQLiteStorage implements IStorage {
  async initialize(): Promise<void> {}
  async getTenant(id: string) { return undefined; }
  async getTenantBySlug(slug: string) { return undefined; }
  async listTenants() { return []; }
  async createTenant(n: string, s: string): Promise<Tenant> { throw new Error("Not implemented"); }
  async ensureDefaultTenant(): Promise<Tenant> { return { id: "1", nombre: "Local", slug: "local", tipo: "clinic", estado: "activo", createdAt: new Date() }; }
  async getTenantCredentials(tId: string) { return undefined; }
  async saveTenantCredentials(tId: string, c: any) {}
  async getUser(id: string) { return undefined; }
  async getUserByUsername(u: string) { return undefined; }
  async createUser(u: any) { return u as any; }
  async updateUserRole(uId: string, r: string) {}
  async getReceptores(t: string) { return []; }
  async getReceptorByDoc(t: string, d: string) { return undefined; }
  async upsertReceptor(t: string, r: any) {}
  async getEmisor(t: string) { return undefined; }
  async saveEmisor(t: string, e: any) { return e; }
  async getFacturas(t: string) { return []; }
  async getFactura(id: string, t: string) { return undefined; }
  async createFactura(t: string, f: any) { return f; }
  async updateFactura(id: string, t: string, f: any) { return undefined; }
  async deleteFactura(id: string, t: string) { return false; }
  async getNextNumeroControl(t: string, n: string, ty: string) { return ""; }
  async getFacturaByCodigoGeneracion(c: string, t: string) { return null; }
  async createApiKey(t: string, n: string) { return ""; }
  async validateApiKey(k: string) { return null; }
  async listApiKeys(t: string) { return []; }
  async deleteApiKey(i: string, t: string) {}
  async addToContingenciaQueue(t: string, f: string, c: string) {}
  async getContingenciaQueue(t: string, e?: string) { return []; }
  async updateContingenciaStatus(c: string, e: string, er?: string) {}
  async marcarContingenciaCompleta(c: string) {}
  async crearAnulacion(t: string, f: string, c: string, m: string, u: string, o?: string) {}
  async getAnulacion(c: string, t: string) { return null; }
  async getAnulacionesPendientes(t: string) { return []; }
  async updateAnulacionStatus(c: string, e: string, s?: string, r?: any, er?: string) {}
  async getHistoricoAnulaciones(t: string, l?: number) { return []; }
}

// Fallback MemStorage
export class MemStorage implements IStorage {
  async initialize() {}
  async getTenant(id: string) { return undefined; }
  async getTenantBySlug(slug: string) { return undefined; }
  async listTenants() { return []; }
  async createTenant(n: string, s: string): Promise<Tenant> { throw new Error("Not implemented"); }
  async ensureDefaultTenant(): Promise<Tenant> { return { id: "1", nombre: "Mem", slug: "mem", tipo: "clinic", estado: "activo", createdAt: new Date() }; }
  async getTenantCredentials(tId: string) { return undefined; }
  async saveTenantCredentials(tId: string, c: any) {}
  async getUser(id: string) { return undefined; }
  async getUserByUsername(u: string) { return undefined; }
  async createUser(u: any) { return u; }
  async updateUserRole(uId: string, r: string) {}
  async getReceptores(t: string) { return []; }
  async getReceptorByDoc(t: string, d: string) { return undefined; }
  async upsertReceptor(t: string, r: any) {}
  async getEmisor(t: string) { return undefined; }
  async saveEmisor(t: string, e: any) { return e; }
  async getFacturas(t: string) { return []; }
  async getFactura(id: string, t: string) { return undefined; }
  async createFactura(t: string, f: any) { return f; }
  async updateFactura(id: string, t: string, f: any) { return undefined; }
  async deleteFactura(id: string, t: string) { return false; }
  async getNextNumeroControl(t: string, n: string, ty: string) { return ""; }
  async getFacturaByCodigoGeneracion(c: string, t: string) { return null; }
  async createApiKey(t: string, n: string) { return ""; }
  async validateApiKey(k: string) { return null; }
  async listApiKeys(t: string) { return []; }
  async deleteApiKey(i: string, t: string) {}
  async addToContingenciaQueue(t: string, f: string, c: string) {}
  async getContingenciaQueue(t: string, e?: string) { return []; }
  async updateContingenciaStatus(c: string, e: string, er?: string) {}
  async marcarContingenciaCompleta(c: string) {}
  async crearAnulacion(t: string, f: string, c: string, m: string, u: string, o?: string) {}
  async getAnulacion(c: string, t: string) { return null; }
  async getAnulacionesPendientes(t: string) { return []; }
  async updateAnulacionStatus(c: string, e: string, s?: string, r?: any, er?: string) {}
  async getHistoricoAnulaciones(t: string, l?: number) { return []; }
}

const useSQLite = process.env.USE_SQLITE === "true";
const usePostgres = process.env.DATABASE_URL && !useSQLite;

export const storage: IStorage = usePostgres 
  ? new DatabaseStorage() 
  : useSQLite 
    ? new SQLiteStorage() 
    : new MemStorage();
