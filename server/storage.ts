import { type User, type InsertUser, type Factura, type InsertFactura, type Emisor } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export const storage = new MemStorage();
