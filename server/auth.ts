import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";

const sessions = new Map<string, string>();

function generateSessionId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers["cookie"];
  const result: Record<string, string> = {};
  if (!header) return result;
  const parts = header.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    result[key] = decodeURIComponent(rest.join("="));
  }
  return result;
}

function getSessionId(req: Request): string | undefined {
  const cookies = parseCookies(req);
  return cookies["sessionId"];
}

// Middleware base
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sid = getSessionId(req);
    if (!sid) return res.status(401).json({ message: "No autenticado" });
    const userId = sessions.get(sid);
    if (!userId) return res.status(401).json({ message: "Sesión inválida" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Usuario no encontrado" });
    
    (req as any).user = { 
      id: user.id, 
      username: user.username,
      tenantId: user.tenantId,
      role: user.role
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Middleware de roles específicos
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Acceso denegado: Rol insuficiente" });
    }
    next();
  };
}

// Helpers rápidos
export const requireSuperAdmin = [requireAuth, requireRole(["super_admin"])];
export const requireTenantAdmin = [requireAuth, requireRole(["super_admin", "tenant_admin"])];
export const requireManager = [requireAuth, requireRole(["super_admin", "tenant_admin", "manager"])];

// Rutas de autenticación
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      
      const { username, password } = parsed.data;
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const sessionId = generateSessionId();
      sessions.set(sessionId, user.id);

      res.cookie("sessionId", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ 
        user: { 
          id: user.id, 
          username: user.username,
          tenantId: user.tenantId,
          role: user.role
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Error en login" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const sid = getSessionId(req);
    if (sid) sessions.delete(sid);
    res.cookie("sessionId", "", { maxAge: 0 });
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const sid = getSessionId(req);
      if (!sid) return res.status(401).json({ message: "No autenticado" });
      const userId = sessions.get(sid);
      if (!userId) return res.status(401).json({ message: "Sesión inválida" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Usuario no encontrado" });
      
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username,
          tenantId: user.tenantId,
          role: user.role
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Error al obtener usuario" });
    }
  });
}