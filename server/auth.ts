import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { logAudit, logLoginAttempt, AuditActions, getClientIP, getUserAgent } from "./lib/audit";

// Configuración JWT
import { randomBytes } from "crypto";

if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET) throw new Error("CRITICAL SECURITY: JWT_SECRET environment variable is required in production.");
  if (!process.env.JWT_REFRESH_SECRET) throw new Error("CRITICAL SECURITY: JWT_REFRESH_SECRET environment variable is required in production.");
}

// Si no hay secretos (Dev/Test), generamos uno aleatorio EFÍMERO.
// Esto es seguro porque nadie puede adivinarlo, pero invalidará todas las sesiones al reiniciar el servidor.
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(64).toString("hex");
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || randomBytes(64).toString("hex");

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  ADVERTENCIA DE SEGURIDAD: Usando secretos JWT generados aleatoriamente. Las sesiones se invalidarán al reiniciar.");
}
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutos
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 días
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutos en ms

interface TokenPayload {
  userId: string;
  username: string;
  email?: string;
  role: string;
  tenantId?: string;
}

// Generar tokens JWT
function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

// Verificar tokens
function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// Parser de cookies
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

async function checkAccountLock(user: any): Promise<{ locked: boolean; reason?: string }> {
  if (user.accountLocked && user.lockUntil) {
    const now = new Date();
    if (now < new Date(user.lockUntil)) {
      const minutesLeft = Math.ceil((new Date(user.lockUntil).getTime() - now.getTime()) / 60000);
      return { locked: true, reason: `Cuenta bloqueada. Intenta de nuevo en ${minutesLeft} minuto(s).` };
    }
  }
  return { locked: false };
}

// Middleware de autenticación JWT
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const cookies = parseCookies(req);
    const accessToken = cookies["accessToken"];
    
    if (!accessToken) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const payload = verifyAccessToken(accessToken);
    if (!payload) {
      return res.status(401).json({ message: "Token inválido o expirado" });
    }

    const user = await storage.getUser(payload.userId);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    // Verificar bloqueo de cuenta
    const lockStatus = await checkAccountLock(user);
    if (lockStatus.locked) {
      return res.status(403).json({ message: lockStatus.reason });
    }

    (req as any).user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
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

// Middleware para API Keys (Integración SIGMA)
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.toString().replace("Bearer ", "");
  
  if (!apiKey || typeof apiKey !== "string") {
    return res.status(401).json({ message: "API Key requerida" });
  }

  const result = await storage.validateApiKey(apiKey);
  if (!result) {
    return res.status(401).json({ message: "API Key inválida o inactiva" });
  }

  // Inyectar un usuario virtual basado en el Tenant
  (req as any).user = {
    id: "api-system",
    username: "api-system",
    role: "manager", // Permisos de manager para emitir facturas
    tenantId: result.tenantId,
  };

  next();
}

// Helpers rápidos
export const requireSuperAdmin = [requireAuth, requireRole(["super_admin"])];
export const requireTenantAdmin = [requireAuth, requireRole(["super_admin", "tenant_admin"])];
export const requireManager = [requireAuth, requireRole(["super_admin", "tenant_admin", "manager"])];

// Schemas de validación
const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, "Usuario o email requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Usuario debe tener al menos 3 caracteres"),
  email: z.string().email("Email inválido").optional(),
  password: z.string().min(8, "Contraseña debe tener al menos 8 caracteres"),
});

export function registerAuthRoutes(app: Express) {
  // Login con username o email
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const ipAddress = getClientIP(req);
    const userAgent = req.headers["user-agent"];
    
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const { usernameOrEmail, password } = parsed.data;

      // Buscar usuario por username o email
      let user = await storage.getUserByUsername(usernameOrEmail);
      if (!user && typeof (storage as any).getUserByEmail === "function") {
        user = await (storage as any).getUserByEmail(usernameOrEmail);
      }

      if (!user) {
        await logLoginAttempt({ username: usernameOrEmail, ipAddress, success: false, userAgent });
        await logAudit({ userId: null, action: AuditActions.LOGIN_FAILED, ipAddress, userAgent, details: { reason: "user_not_found" } });
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Verificar bloqueo de cuenta
      const lockStatus = await checkAccountLock(user);
      if (lockStatus.locked) {
        await logAudit({ userId: user.id, action: "login_blocked", ipAddress, userAgent });
        return res.status(403).json({ message: lockStatus.reason });
      }

      // Verificar contraseña
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        await logLoginAttempt({ username: user.username, ipAddress, success: false, userAgent });
        await logAudit({ userId: user.id, action: AuditActions.LOGIN_FAILED, ipAddress, userAgent, details: { reason: "wrong_password" } });
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Login exitoso
      await logLoginAttempt({ username: user.username, ipAddress, success: true, userAgent });
      await logAudit({ userId: user.id, action: AuditActions.LOGIN_SUCCESS, ipAddress, userAgent });

      // Generar tokens JWT
      const tokenPayload: TokenPayload = {
        userId: user.id,
        username: user.username,
        email: user.email || undefined,
        role: user.role,
        tenantId: user.tenantId || undefined,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Establecer cookies httpOnly seguras
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 15 * 60 * 1000, // 15 minutos
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      });

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      await logAudit({ userId: null, action: "login_error", ipAddress, userAgent, details: { error: String(error) } });
      res.status(500).json({ message: "Error en login" });
    }
  });

  // Refresh token para renovar access token sin re-login
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const cookies = parseCookies(req);
      const refreshToken = cookies["refreshToken"];

      if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token" });
      }

      const payload = verifyRefreshToken(refreshToken);
      if (!payload) {
        return res.status(401).json({ message: "Refresh token inválido" });
      }

      const user = await storage.getUser(payload.userId);
      if (!user) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      // Verificar bloqueo
      const lockStatus = await checkAccountLock(user);
      if (lockStatus.locked) {
        return res.status(403).json({ message: lockStatus.reason });
      }

      // Generar nuevo access token
      const tokenPayload: TokenPayload = {
        userId: user.id,
        username: user.username,
        email: user.email || undefined,
        role: user.role,
        tenantId: user.tenantId || undefined,
      };

      const newAccessToken = generateAccessToken(tokenPayload);

      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 15 * 60 * 1000,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error al refrescar token" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const ipAddress = getClientIP(req);
    const userAgent = getUserAgent(req);
    const user = (req as any).user;

    if (user) {
      await logAudit({ userId: user.id, action: AuditActions.LOGOUT, ipAddress, userAgent });
    }

    res.cookie("accessToken", "", { maxAge: 0 });
    res.cookie("refreshToken", "", { maxAge: 0 });
    res.json({ success: true });
  });

  // Me (usuario actual)
  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    res.json({ user });
  });

  // --- GESTIÓN DE API KEYS (Solo Tenant Admin) ---
  
  app.get("/api/auth/api-keys", ...requireTenantAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const keys = await storage.listApiKeys(user.tenantId);
    res.json(keys);
  });

  app.post("/api/auth/api-keys", ...requireTenantAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Nombre de la llave requerido" });
    
    const key = await storage.createApiKey(user.tenantId, name);
    res.status(201).json({ key, name });
  });

  app.delete("/api/auth/api-keys/:id", ...requireTenantAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    await storage.deleteApiKey(req.params.id, user.tenantId);
    res.status(204).send();
  });
}