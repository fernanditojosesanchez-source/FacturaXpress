import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { storage } from "./storage.js";
import { logger } from "./lib/logger.js";

import { logAudit, logLoginAttempt, AuditActions, getClientIP, getUserAgent } from "./lib/audit.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
// Service Role for Admin tasks on Dedicated DB
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(supabaseUrl!, process.env.SUPABASE_SERVICE_ROLE_KEY!) : null;
// Client for Dedicated DB (if you ever need to sign in as local user)
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// AUTH BRIDGE: Main SIGMA Project
const mainSupabaseUrl = process.env.MAIN_SUPABASE_URL;
const mainSupabaseKey = process.env.MAIN_SUPABASE_ANON_KEY;
const mainSupabase = (mainSupabaseUrl && mainSupabaseKey) ? createClient(mainSupabaseUrl, mainSupabaseKey) : null;

if (!mainSupabase) {
  logger.warn("⚠️  AUTH BRIDGE WARNING: MAIN_SUPABASE_URL/KEY not found. Cross-project auth will fail.");
}


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
  logger.warn("⚠️  ADVERTENCIA DE SEGURIDAD: Usando secretos JWT generados aleatoriamente. Las sesiones se invalidarán al reiniciar.");
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
  sucursales_asignadas?: string[] | null;
  modulos_habilitados?: Record<string, boolean> | null;
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
    // 1. Check Bearer Token (Supabase Bridge)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      let sbUser: any = null;

      // A. Try Main Ecosystem Project (Priority)
      if (mainSupabase) {
        const { data, error } = await mainSupabase.auth.getUser(token);
        if (!error && data.user) {
          sbUser = data.user;
        }
      }

      // B. Try Dedicated Project (Fallback)
      if (!sbUser && supabase) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data.user) {
          sbUser = data.user;
        }
      }

      if (sbUser) {
        // Sync Logic: Ensure user exists in local dedicated DB
        let localUser = await storage.getUserByUsername(sbUser.email || sbUser.id);

        if (!localUser && sbUser.email) {
          // Auto-Sync / Just-In-Time Provisioning
          logger.info(`[AuthBridge] Syncing user ${sbUser.email} from Supabase...`);

          try {
            // Generate a random internal password as they authenticate via Supabase
            const dummyHash = await bcrypt.hash(randomBytes(16).toString("hex"), 10);

            // Get tenant from metadata or default
            const tenantId = sbUser.app_metadata?.tenant_id || sbUser.user_metadata?.tenant_id;

            localUser = await (storage as any).createUser({
              username: sbUser.email,
              email: sbUser.email,
              password: dummyHash,
              role: sbUser.app_metadata?.role || "cashier",
              tenantId: tenantId,
              sucursales_asignadas: sbUser.user_metadata?.sucursales_asignadas || [],
              modulos_habilitados: sbUser.user_metadata?.modulos_habilitados || {}
            });
          } catch (err) {
            logger.error("[AuthBridge] Failed to sync user:", err);
            // Proceed as virtual user if DB write fails, but restricted
          }

        }

        const role = sbUser.app_metadata?.role || sbUser.user_metadata?.role || "cashier";
        const tenantId = sbUser.app_metadata?.tenant_id || sbUser.user_metadata?.tenant_id;

        (req as any).user = {
          id: localUser?.id || sbUser.id,
          username: sbUser.email || "supabase_user",
          email: sbUser.email,
          role: localUser?.role || role,
          tenantId: localUser?.tenantId || tenantId,
        };
        return next();
      }
    }

    // 2. Legacy Cookies
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

      // 1. Attempt Supabase Auth First
      let authSuccessful = false;
      let user: any = null;

      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: usernameOrEmail,
          password: password,
        });

        if (data.user && !error) {
          authSuccessful = true;
          // Sync User to Local DB
          const sbUser = data.user;
          user = await storage.getUserByUsername(sbUser.email!);

          if (!user) {
            // Create if missing. Generate dummy password hash.
            // We use email as username for consistency
            const dummyHash = await bcrypt.hash(randomBytes(16).toString("hex"), 10);
            try {
              // Ensure tenantId exists? Assuming it's in metadata or global default
              const tenantId = sbUser.user_metadata?.tenant_id || sbUser.app_metadata?.tenant_id;
              // Wait, create user might strict on schema.
              // We'll trust existing storage.createUser if available or try direct insert logic if possible.
              // Assuming storage.createUser(insertUserSchema)
              user = await (storage as any).createUser({
                username: sbUser.email!,
                password: dummyHash,
                role: sbUser.user_metadata?.role || "cashier",
                tenantId: tenantId,
                email: sbUser.email
              });
            } catch (createErr) {
              logger.warn("Auto-creation failed, using virtual user:", createErr);

              // Fallback to virtual user object without ID in DB? Dangerous for relations.
              // We will try to fetch again or fail.
            }
          }
        }
      }

      // 2. Fallback to Local Auth if Supabase failed (or not configured)
      if (!authSuccessful) {
        // Buscar usuario por username o email
        user = await storage.getUserByUsername(usernameOrEmail);
        if (!user && typeof (storage as any).getUserByEmail === "function") {
          user = await (storage as any).getUserByEmail(usernameOrEmail);
        }

        if (!user) {
          await logLoginAttempt({ username: usernameOrEmail, ipAddress, success: false, userAgent });
          await logAudit({ userId: null, action: AuditActions.LOGIN_FAILED, ipAddress, userAgent, details: { reason: "user_not_found" } });
          return res.status(401).json({ message: "Credenciales inválidas" });
        }

        // Verificar contraseña
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          await logLoginAttempt({ username: user.username, ipAddress, success: false, userAgent });
          await logAudit({ userId: user.id, action: AuditActions.LOGIN_FAILED, ipAddress, userAgent, details: { reason: "wrong_password" } });
          return res.status(401).json({ message: "Credenciales inválidas" });
        }
      }

      // Login exitoso (Common path)


      // Login exitoso
      await logLoginAttempt({ username: user.username, ipAddress, success: true, userAgent });
      await logAudit({ userId: user.id, action: AuditActions.LOGIN_SUCCESS, ipAddress, userAgent });

      // Generar tokens JWT con permisos completos
      const tokenPayload: TokenPayload = {
        userId: user.id,
        username: user.username,
        email: user.email || undefined,
        role: user.role,
        tenantId: user.tenantId || undefined,
        sucursales_asignadas: (user as any).sucursales_asignadas || null,
        modulos_habilitados: (user as any).modulos_habilitados || null,
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
          sucursales_asignadas: (user as any).sucursales_asignadas,
          modulos_habilitados: (user as any).modulos_habilitados,
        },
      });
    } catch (error) {
      logger.error("Login error:", error);

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

// ============================================
// SISTEMA DE PERMISOS Y CONTROL DE ACCESO
// ============================================

export type Permission =
  | "create_invoice"
  | "view_invoices"
  | "transmit_invoice"
  | "invalidate_invoice"
  | "cancel_invoice"
  | "manage_clients"
  | "manage_inventory"
  | "manage_products"
  | "manage_branches"
  | "manage_users"
  | "assign_roles"
  | "view_reports"
  | "download_books"
  | "export_data"
  | "configure_company"
  | "configure_mh_credentials"
  | "view_dashboard"
  | "view_global_metrics"
  | "manage_all_tenants"
  | "manage_plans"
  | "view_financial_dashboard"
  | "view_inventory_branch"
  | "request_transfers"
  | "view_reports_branch"
  | "view_dashboard_branch"
  | "view_stock"
  | "search_products"
  | "search_invoices"
  | "download_pdf"
  | "view_audit_logs"
  | "manage_integrations";

export type Module = "inventario" | "facturacion" | "reportes" | "contabilidad" | "multi_sucursal";

// Obtener permisos por rol
export function getPermissionsByRole(role: string): Permission[] {
  switch (role) {
    case "super_admin":
      return [
        "view_global_metrics",
        "manage_all_tenants",
        "manage_plans",
        "manage_integrations",
        "view_audit_logs",
        "create_invoice",
        "view_invoices",
        "transmit_invoice",
        "invalidate_invoice",
        "cancel_invoice",
        "manage_clients",
        "manage_inventory",
        "manage_products",
        "manage_branches",
        "manage_users",
        "assign_roles",
        "view_reports",
        "download_books",
        "export_data",
        "configure_company",
        "configure_mh_credentials",
        "view_dashboard",
      ];

    case "tenant_admin":
      return [
        "create_invoice",
        "view_invoices",
        "transmit_invoice",
        "invalidate_invoice",
        "cancel_invoice",
        "manage_clients",
        "manage_inventory",
        "manage_products",
        "manage_branches",
        "manage_users",
        "assign_roles",
        "view_reports",
        "download_books",
        "export_data",
        "configure_company",
        "configure_mh_credentials",
        "view_dashboard",
        "view_audit_logs",
      ];

    case "manager":
      return [
        "create_invoice",
        "view_invoices",
        "transmit_invoice",
        "invalidate_invoice",
        "cancel_invoice",
        "manage_clients",
        "view_inventory_branch",
        "request_transfers",
        "view_reports_branch",
        "view_dashboard_branch",
      ];

    case "cashier":
      return [
        "create_invoice",
        "view_invoices",
        "view_stock",
        "search_products",
      ];

    case "accountant":
      return [
        "view_invoices",
        "view_reports",
        "download_books",
        "export_data",
        "view_financial_dashboard",
      ];

    case "sigma_readonly":
      return [
        "view_invoices",
        "search_invoices",
        "download_pdf",
      ];

    default:
      return [];
  }
}

// Middleware: Verificar permiso
export const checkPermission = (requiredPermission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const userPermissions = getPermissionsByRole(user.role);

    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({
        error: "Sin permisos suficientes",
        requerido: requiredPermission,
      });
    }

    next();
  };
};

// Middleware: Verificar acceso a sucursal
export const checkBranchAccess = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "No autenticado" });
  }

  // Super admin y tenant_admin no tienen restricción
  if (["super_admin", "tenant_admin"].includes(user.role)) {
    next();
    return;
  }

  const branchId = req.params.branchId || req.body.branchId;

  // Si no hay sucursal_asignadas, denegar
  if (!user.sucursales_asignadas || !Array.isArray(user.sucursales_asignadas)) {
    return res.status(403).json({
      error: "Usuario no tiene sucursales asignadas",
    });
  }

  // Verificar si tiene acceso a esa sucursal
  if (!user.sucursales_asignadas.includes(branchId)) {
    return res.status(403).json({
      error: "No tienes acceso a esta sucursal",
    });
  }

  next();
};

// Middleware: Verificar módulo habilitado
export const checkModuleEnabled = (module: Module) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    // Super admin siempre tiene acceso
    if (user.role === "super_admin") {
      next();
      return;
    }

    // Si el usuario tiene módulos personalizados, usar esos
    if (user.modulos_habilitados && typeof user.modulos_habilitados === "object") {
      if (!user.modulos_habilitados[module]) {
        return res.status(403).json({
          error: `Módulo '${module}' no habilitado para este usuario`,
        });
      }
      next();
      return;
    }

    // Si no hay override, ir al siguiente middleware/ruta
    // (Probablemente deba cargar los módulos del tenant)
    next();
  };
};

// Helper: Obtener módulos disponibles
export function getModulesForUser(user: TokenPayload, tenantModules: Record<string, boolean>) {
  if (user.modulos_habilitados) {
    return user.modulos_habilitados;
  }
  return tenantModules;
}

// Helper: ¿Puede gestionar usuario?
export function canManageUser(actor: TokenPayload, targetUserRole: string): boolean {
  if (actor.role === "super_admin") {
    return true;
  }

  if (actor.role === "tenant_admin") {
    if (targetUserRole === "super_admin") {
      return false;
    }
    return true;
  }

  return false;
}

// Helper: ¿Es válido este cambio de rol?
export function isValidRoleChange(
  actor: TokenPayload,
  newRole: string
): { valid: boolean; reason?: string } {
  if (actor.role === "super_admin") {
    return { valid: true };
  }

  if (actor.role === "tenant_admin" && newRole === "super_admin") {
    return {
      valid: false,
      reason: "No puedes asignar el rol super_admin",
    };
  }

  if (actor.role === "tenant_admin") {
    const allowedRoles = ["manager", "cashier", "accountant", "sigma_readonly"];
    if (!allowedRoles.includes(newRole)) {
      return {
        valid: false,
        reason: `No puedes asignar el rol ${newRole}`,
      };
    }
    return { valid: true };
  }

  return {
    valid: false,
    reason: "Tu rol no permite gestionar usuarios",
  };
}