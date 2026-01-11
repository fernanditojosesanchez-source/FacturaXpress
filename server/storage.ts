import { 
  type User, type InsertUser, type Factura, type InsertFactura, type Emisor, type Tenant,
  users, emisorTable, facturasTable, secuencialControlTable, tenants, facturaItemsTable,
  tenantCredentials, receptoresTable
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

  async createFactura(tenantId: string, insertFactura: InsertFactura): Promise<Factura> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const factura: Factura = { ...insertFactura, id, createdAt, tenantId };
    
    await db.transaction(async (tx) => {
      await tx.insert(facturasTable).values({
        id,
        tenantId,
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
}

const useSQLite = process.env.USE_SQLITE === "true";
const usePostgres = process.env.DATABASE_URL && !useSQLite;

export const storage: IStorage = usePostgres 
  ? new DatabaseStorage() 
  : useSQLite 
    ? new SQLiteStorage() 
    : new MemStorage();
