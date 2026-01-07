import { type User, type InsertUser, type Factura, type InsertFactura, type Emisor, users, emisorTable, facturasTable, secuencialControlTable } from "@shared/schema";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getEmisor(): Promise<Emisor | undefined>;
  saveEmisor(emisor: Emisor): Promise<Emisor>;
  
  getFacturas(): Promise<Factura[]>;
  getFactura(id: string): Promise<Factura | undefined>;
  createFactura(factura: InsertFactura): Promise<Factura>;
  updateFactura(id: string, factura: Partial<Factura>): Promise<Factura | undefined>;
  deleteFactura(id: string): Promise<boolean>;
  getNextNumeroControl(emisorNit: string, tipoDte: string): Promise<string>;
  getFacturaByCodigoGeneracion(codigoGen: string): Promise<Factura | null>;
  initialize(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async initialize(): Promise<void> {
    // Migrations are handled by drizzle-kit
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
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getEmisor(): Promise<Emisor | undefined> {
    const [row] = await db.select().from(emisorTable).limit(1);
    return row ? (row.data as Emisor) : undefined;
  }

  async saveEmisor(emisor: Emisor): Promise<Emisor> {
    await db.delete(emisorTable);
    await db.insert(emisorTable).values({
      id: "1",
      data: emisor,
    });
    return emisor;
  }

  async getFacturas(): Promise<Factura[]> {
    const rows = await db.select().from(facturasTable).orderBy(desc(facturasTable.createdAt));
    return rows.map(row => row.data as Factura);
  }

  async getFactura(id: string): Promise<Factura | undefined> {
    const [row] = await db.select().from(facturasTable).where(eq(facturasTable.id, id));
    return row ? (row.data as Factura) : undefined;
  }

  async createFactura(insertFactura: InsertFactura): Promise<Factura> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const factura: Factura = { ...insertFactura, id, createdAt };
    
    await db.insert(facturasTable).values({
      id,
      data: factura,
      createdAt: new Date(createdAt),
      fecEmi: insertFactura.fecEmi,
    });
    
    return factura;
  }

  async updateFactura(id: string, updates: Partial<Factura>): Promise<Factura | undefined> {
    const current = await this.getFactura(id);
    if (!current) return undefined;
    
    const updated = { ...current, ...updates };
    
    await db.update(facturasTable)
      .set({ data: updated })
      .where(eq(facturasTable.id, id));
      
    return updated;
  }

  async deleteFactura(id: string): Promise<boolean> {
    const result = await db.delete(facturasTable).where(eq(facturasTable.id, id)).returning();
    return result.length > 0;
  }

  async getNextNumeroControl(emisorNit: string, tipoDte: string): Promise<string> {
    return await db.transaction(async (tx) => {
      // Intentar obtener el registro actual
      let [record] = await tx
        .select()
        .from(secuencialControlTable)
        .where(
          sql`${secuencialControlTable.emisorNit} = ${emisorNit} AND ${secuencialControlTable.tipoDte} = ${tipoDte}`
        );

      let newSecuencial = 1;

      if (!record) {
        // Crear nuevo registro si no existe
        [record] = await tx
          .insert(secuencialControlTable)
          .values({
            emisorNit,
            tipoDte,
            secuencial: 1,
            fechaCreacion: new Date(),
            fechaActualizacion: new Date(),
          })
          .returning();
      } else {
        // Incrementar si existe
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

      // Formatear: DTE-01-12345678-9-000000000000001
      // NOTA: El formato estándar DGII es más complejo, pero mantendremos
      // la lógica compatible con lo que había en SQLiteStorage
      const prefix = String(tipoDte).padStart(3, '0');
      const suffix = String(newSecuencial).padStart(18, '0');
      const numeroControl = `${prefix}-${suffix}`;

      await tx.update(secuencialControlTable)
        .set({ ultimoNumeroControl: numeroControl })
        .where(eq(secuencialControlTable.id, record.id));

      return numeroControl;
    });
  }

  async getFacturaByCodigoGeneracion(codigoGen: string): Promise<Factura | null> {
    // Busqueda en JSONB es específica de Postgres
    // data->>'codigoGeneracion' = codigoGen
    const [row] = await db
      .select()
      .from(facturasTable)
      .where(sql`data->>'codigoGeneracion' = ${codigoGen}`)
      .limit(1);
      
    return row ? (row.data as Factura) : null;
  }
}

export class SQLiteStorage implements IStorage {
  private db: Database.Database;
  private initialized = false;

  constructor(dbPath?: string) {
    const filePath = dbPath || path.join(path.dirname(__dirname), "app.db");
    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emisor (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS facturas (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        fecEmi TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS secuencial_control (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emisor_nit TEXT NOT NULL,
        tipo_dte TEXT NOT NULL,
        secuencial INTEGER NOT NULL DEFAULT 1,
        ultimo_numero_control TEXT,
        fecha_creacion INTEGER NOT NULL,
        fecha_actualizacion INTEGER NOT NULL,
        UNIQUE(emisor_nit, tipo_dte)
      )
    `);

    this.initialized = true;
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
      const row = stmt.get(id) as any;
      return row ? { id: row.id, username: row.username, password: row.password } : undefined;
    } catch {
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const stmt = this.db.prepare("SELECT * FROM users WHERE username = ?");
      const row = stmt.get(username) as any;
      return row ? { id: row.id, username: row.username, password: row.password } : undefined;
    } catch {
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const stmt = this.db.prepare(
      "INSERT INTO users (id, username, password) VALUES (?, ?, ?)"
    );
    stmt.run(id, insertUser.username, insertUser.password);
    return { id, ...insertUser };
  }

  async getEmisor(): Promise<Emisor | undefined> {
    try {
      const stmt = this.db.prepare("SELECT data FROM emisor LIMIT 1");
      const row = stmt.get() as any;
      return row ? JSON.parse(row.data) : undefined;
    } catch {
      return undefined;
    }
  }

  async saveEmisor(emisor: Emisor): Promise<Emisor> {
    const stmt = this.db.prepare("DELETE FROM emisor");
    stmt.run();
    
    const insertStmt = this.db.prepare(
      "INSERT INTO emisor (id, data) VALUES (?, ?)"
    );
    insertStmt.run("1", JSON.stringify(emisor));
    
    return emisor;
  }

  async getFacturas(): Promise<Factura[]> {
    try {
      const stmt = this.db.prepare(
        "SELECT data, createdAt, fecEmi FROM facturas ORDER BY createdAt DESC"
      );
      const rows = stmt.all() as any[];
      return rows.map(row => JSON.parse(row.data));
    } catch {
      return [];
    }
  }

  async getFactura(id: string): Promise<Factura | undefined> {
    try {
      const stmt = this.db.prepare("SELECT data FROM facturas WHERE id = ?");
      const row = stmt.get(id) as any;
      return row ? JSON.parse(row.data) : undefined;
    } catch {
      return undefined;
    }
  }

  async createFactura(insertFactura: InsertFactura): Promise<Factura> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const factura: Factura = { ...insertFactura, id, createdAt };
    
    const stmt = this.db.prepare(
      "INSERT INTO facturas (id, data, createdAt, fecEmi) VALUES (?, ?, ?, ?)"
    );
    stmt.run(id, JSON.stringify(factura), createdAt, insertFactura.fecEmi);
    
    return factura;
  }

  async updateFactura(id: string, updates: Partial<Factura>): Promise<Factura | undefined> {
    const existing = await this.getFactura(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    const stmt = this.db.prepare(
      "UPDATE facturas SET data = ? WHERE id = ?"
    );
    stmt.run(JSON.stringify(updated), id);
    
    return updated;
  }

  async deleteFactura(id: string): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM facturas WHERE id = ?");
    const result = stmt.run(id);
    return (result.changes || 0) > 0;
  }

  async getNextNumeroControl(emisorNit: string, tipoDte: string): Promise<string> {
    const now = Date.now();
    
    const selectStmt = this.db.prepare(
      `SELECT * FROM secuencial_control 
       WHERE emisor_nit = ? AND tipo_dte = ?`
    );
    let record = selectStmt.get(emisorNit, tipoDte) as any;
    
    if (!record) {
      const insertStmt = this.db.prepare(
        `INSERT INTO secuencial_control 
         (emisor_nit, tipo_dte, secuencial, fecha_creacion, fecha_actualizacion)
         VALUES (?, ?, ?, ?, ?)`
      );
      insertStmt.run(emisorNit, tipoDte, 1, now, now);
      record = { secuencial: 1 };
    }
    
    const newSecuencial = record.secuencial + 1;
    
    const prefix = String(tipoDte).padStart(3, '0');
    const suffix = String(newSecuencial).padStart(18, '0');
    const numeroControl = `${prefix}-${suffix}`;
    
    const updateStmt = this.db.prepare(
      `UPDATE secuencial_control 
       SET secuencial = ?, ultimo_numero_control = ?, fecha_actualizacion = ?
       WHERE emisor_nit = ? AND tipo_dte = ?`
    );
    updateStmt.run(newSecuencial, numeroControl, now, emisorNit, tipoDte);
    
    return numeroControl;
  }

  async getFacturaByCodigoGeneracion(codigoGen: string): Promise<Factura | null> {
    try {
      const stmt = this.db.prepare(
        `SELECT data FROM facturas WHERE data LIKE ?`
      );
      const row = stmt.get(`%"codigoGeneracion":"${codigoGen}"%`) as any;
      
      if (!row) return null;
      
      return JSON.parse(row.data);
    } catch {
      return null;
    }
  }

  close(): void {
    this.db.close();
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private emisor: Emisor | undefined;
  private facturas: Map<string, Factura>;

  constructor() {
    this.users = new Map();
    this.facturas = new Map();
    this.emisor = undefined;
  }

  async initialize(): Promise<void> {}

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getEmisor(): Promise<Emisor | undefined> {
    return this.emisor;
  }

  async saveEmisor(emisor: Emisor): Promise<Emisor> {
    this.emisor = emisor;
    return emisor;
  }

  async getFacturas(): Promise<Factura[]> {
    return Array.from(this.facturas.values()).sort((a, b) => {
      const dateA = new Date(a.createdAt || a.fecEmi);
      const dateB = new Date(b.createdAt || b.fecEmi);
      return dateB.getTime() - dateA.getTime();
    });
  }

  async getFactura(id: string): Promise<Factura | undefined> {
    return this.facturas.get(id);
  }

  async createFactura(insertFactura: InsertFactura): Promise<Factura> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const factura: Factura = { ...insertFactura, id, createdAt };
    this.facturas.set(id, factura);
    return factura;
  }

  async updateFactura(id: string, updates: Partial<Factura>): Promise<Factura | undefined> {
    const existing = this.facturas.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.facturas.set(id, updated);
    return updated;
  }

  async deleteFactura(id: string): Promise<boolean> {
    return this.facturas.delete(id);
  }

  async getNextNumeroControl(emisorNit: string, tipoDte: string): Promise<string> {
    // Implementación mock simple para MemStorage
    return `${tipoDte}-${Date.now().toString().slice(-14)}`;
  }

  async getFacturaByCodigoGeneracion(codigoGen: string): Promise<Factura | null> {
    for (const factura of this.facturas.values()) {
      if (factura.codigoGeneracion === codigoGen) return factura;
    }
    return null;
  }
}

// Lógica de selección de Storage
const useSQLite = process.env.USE_SQLITE === "true";
const usePostgres = process.env.DATABASE_URL && !useSQLite;

export const storage: IStorage = usePostgres 
  ? new DatabaseStorage() 
  : useSQLite 
    ? new SQLiteStorage() 
    : new MemStorage();