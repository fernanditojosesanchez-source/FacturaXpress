import type { Express, Request, Response } from "express";
import { requireAuth, requireTenantAdmin, requireSuperAdmin, checkPermission, checkBranchAccess, isValidRoleChange, getPermissionsByRole } from "../auth.js";
import { storage } from "../storage.js";
import { db } from "../db.js";
import { users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { logAudit, AuditActions, getClientIP, getUserAgent } from "../lib/audit.js";
import { z } from "zod";

// Schemas de validación
const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional(),
  nombre: z.string().max(100).optional(),
  password: z.string().min(8),
  role: z.enum(["super_admin", "tenant_admin", "manager", "cashier", "accountant", "sigma_readonly"]),
  sucursales_asignadas: z.array(z.string().uuid()).nullable().optional(),
  modulos_habilitados: z.record(z.boolean()).nullable().optional(),
  telefono: z.string().max(20).optional(),
});

const updatePermissionsSchema = z.object({
  role: z.enum(["super_admin", "tenant_admin", "manager", "cashier", "accountant", "sigma_readonly"]).optional(),
  sucursales_asignadas: z.array(z.string().uuid()).nullable().optional(),
  modulos_habilitados: z.record(z.boolean()).nullable().optional(),
});

export function registerUserRoutes(app: Express): void {
  // ============================================
  // 1. LISTAR USUARIOS DEL TENANT
  // ============================================
  
  app.get(
    "/api/tenants/:tenantId/users",
    requireAuth,
    requireTenantAdmin,
    checkPermission("manage_users"),
    async (req: Request, res: Response) => {
      try {
        const actor = (req as any).user;
        const { tenantId } = req.params;

        // Verificar acceso al tenant
        if (actor.tenantId !== tenantId && actor.role !== "super_admin") {
          return res.status(403).json({ error: "No tienes acceso a este tenant" });
        }

        const usuarios = await storage.listUsersByTenant(tenantId);
        
        res.json(
          usuarios.map((u: any) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            nombre: u.nombre,
            role: u.role,
            sucursales_asignadas: u.sucursales_asignadas,
            modulos_habilitados: u.modulos_habilitados,
            telefono: u.telefono,
            activo: u.activo,
            ultimo_acceso: u.ultimo_acceso,
            createdAt: u.createdAt,
          }))
        );

        await logAudit({
          userId: actor.id,
          action: AuditActions.USER_LIST,
          ipAddress: getClientIP(req),
          userAgent: getUserAgent(req),
          details: { tenantId, count: usuarios.length },
        });
      } catch (err) {
        console.error("Error listando usuarios:", err);
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  );

  // ============================================
  // 2. OBTENER USUARIO ESPECÍFICO
  // ============================================

  app.get(
    "/api/tenants/:tenantId/users/:userId",
    requireAuth,
    checkPermission("manage_users"),
    async (req: Request, res: Response) => {
      try {
        const actor = (req as any).user;
        const { tenantId, userId } = req.params;

        if (actor.tenantId !== tenantId && actor.role !== "super_admin") {
          return res.status(403).json({ error: "No tienes acceso a este tenant" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.tenantId !== tenantId) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          nombre: user.nombre,
          role: user.role,
          sucursales_asignadas: (user as any).sucursales_asignadas,
          modulos_habilitados: (user as any).modulos_habilitados,
          telefono: (user as any).telefono,
          activo: (user as any).activo,
          createdAt: user.createdAt,
        });
      } catch (err) {
        console.error("Error obteniendo usuario:", err);
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  );

  // ============================================
  // 3. CREAR USUARIO
  // ============================================

  app.post(
    "/api/tenants/:tenantId/users",
    requireAuth,
    requireTenantAdmin,
    checkPermission("manage_users"),
    async (req: Request, res: Response) => {
      try {
        const actor = (req as any).user;
        const { tenantId } = req.params;

        // Verificar acceso
        if (actor.tenantId !== tenantId && actor.role !== "super_admin") {
          return res.status(403).json({ error: "No tienes acceso a este tenant" });
        }

        // Validar entrada
        const validation = createUserSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ 
            error: "Datos inválidos",
            details: validation.error.errors 
          });
        }

        const { username, email, nombre, password, role, sucursales_asignadas, modulos_habilitados, telefono } = validation.data;

        // Validar que el actor pueda asignar este rol
        const roleValidation = isValidRoleChange(actor, role);
        if (!roleValidation.valid) {
          return res.status(403).json({ error: roleValidation.reason });
        }

        // Verificar que username no exista
        const existing = await storage.getUserByUsername(username);
        if (existing) {
          return res.status(409).json({ error: "Usuario ya existe" });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Crear usuario
        const newUser = await storage.createUser({
          tenantId: tenantId as any,
          username,
          password: passwordHash,
          role,
        });

        // Actualizar campos adicionales si existen
        if (sucursales_asignadas !== undefined || modulos_habilitados !== undefined) {
          await storage.updateUserPermissions(newUser.id, {
            sucursales_asignadas,
            modulos_habilitados,
          });
        }

        // Agregar teléfono, email y nombre si existen
        if (telefono) {
          await storage.updateUserPhone(newUser.id, telefono);
        }
        if (email || nombre) {
          // Actualizar email y nombre mediante update directo
          await db.update(users).set({ email, nombre }).where(eq(users.id, newUser.id));
        }

        await logAudit({
          userId: actor.id,
          action: AuditActions.USER_CREATE,
          ipAddress: getClientIP(req),
          userAgent: getUserAgent(req),
          details: { username, role, targetUserId: newUser.id },
        });

        res.status(201).json({
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
          message: "Usuario creado exitosamente",
        });
      } catch (err: any) {
        console.error("Error creando usuario:", err);
        if (err.message?.includes("unique")) {
          return res.status(409).json({ error: "Usuario ya existe" });
        }
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  );

  // ============================================
  // 4. ACTUALIZAR PERMISOS DE USUARIO
  // ============================================

  app.patch(
    "/api/tenants/:tenantId/users/:userId/permissions",
    requireAuth,
    requireTenantAdmin,
    checkPermission("assign_roles"),
    async (req: Request, res: Response) => {
      try {
        const actor = (req as any).user;
        const { tenantId, userId } = req.params;

        // Verificar acceso
        if (actor.tenantId !== tenantId && actor.role !== "super_admin") {
          return res.status(403).json({ error: "No tienes acceso a este tenant" });
        }

        // Validar entrada
        const validation = updatePermissionsSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ 
            error: "Datos inválidos",
            details: validation.error.errors 
          });
        }

        const { role, sucursales_asignadas, modulos_habilitados } = validation.data;

        // Obtener usuario actual
        const targetUser = await storage.getUser(userId);
        if (!targetUser || targetUser.tenantId !== tenantId) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Validar cambio de rol si se proporciona
        if (role) {
          const roleValidation = isValidRoleChange(actor, role);
          if (!roleValidation.valid) {
            return res.status(403).json({ error: roleValidation.reason });
          }
        }

        // Actualizar permisos
        await storage.updateUserPermissions(userId, {
          role,
          sucursales_asignadas,
          modulos_habilitados,
        });

        await logAudit({
          userId: actor.id,
          action: AuditActions.USER_UPDATE,
          ipAddress: getClientIP(req),
          userAgent: getUserAgent(req),
          details: { targetUserId: userId, changes: { role, sucursales_asignadas, modulos_habilitados } },
        });

        res.json({
          message: "Permisos actualizados",
          role: role || targetUser.role,
          sucursales_asignadas,
          modulos_habilitados,
        });
      } catch (err) {
        console.error("Error actualizando permisos:", err);
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  );

  // ============================================
  // 5. CAMBIAR CONTRASEÑA DEL USUARIO
  // ============================================

  app.post(
    "/api/tenants/:tenantId/users/:userId/change-password",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const actor = (req as any).user;
        const { tenantId, userId } = req.params;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
          return res.status(400).json({ error: "Contraseña actual y nueva requeridas" });
        }

        if (newPassword.length < 8) {
          return res.status(400).json({ error: "Contraseña muy corta (mínimo 8 caracteres)" });
        }

        // Un usuario solo puede cambiar su propia contraseña
        // O un admin puede cambiar la de otro
        const isChangingOwn = actor.id === userId;
        const isAdmin = actor.role === "tenant_admin" && actor.tenantId === tenantId;

        if (!isChangingOwn && !isAdmin) {
          return res.status(403).json({ error: "No tienes permiso para cambiar esta contraseña" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.tenantId !== tenantId) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Si es cambio propio, verificar contraseña actual
        if (isChangingOwn) {
          const valid = await bcrypt.compare(currentPassword, user.password);
          if (!valid) {
            return res.status(401).json({ error: "Contraseña actual incorrecta" });
          }
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await storage.updateUserPassword(userId, passwordHash);

        await logAudit({
          userId: actor.id,
          action: AuditActions.PASSWORD_CHANGE,
          ipAddress: getClientIP(req),
          userAgent: getUserAgent(req),
          details: { targetUserId: userId, changedOwn: isChangingOwn },
        });

        res.json({ message: "Contraseña actualizada" });
      } catch (err) {
        console.error("Error cambiando contraseña:", err);
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  );

  // ============================================
  // 6. DESACTIVAR USUARIO
  // ============================================

  app.patch(
    "/api/tenants/:tenantId/users/:userId/deactivate",
    requireAuth,
    requireTenantAdmin,
    checkPermission("manage_users"),
    async (req: Request, res: Response) => {
      try {
        const actor = (req as any).user;
        const { tenantId, userId } = req.params;

        if (actor.tenantId !== tenantId && actor.role !== "super_admin") {
          return res.status(403).json({ error: "No tienes acceso a este tenant" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.tenantId !== tenantId) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // No permitir desactivar último super_admin
        if (user.role === "super_admin") {
          return res.status(403).json({ error: "No puedes desactivar un super_admin" });
        }

        await storage.updateUserStatus(userId, false);

        await logAudit({
          userId: actor.id,
          action: AuditActions.USER_DEACTIVATE,
          ipAddress: getClientIP(req),
          userAgent: getUserAgent(req),
          details: { targetUserId: userId },
        });

        res.json({ message: "Usuario desactivado" });
      } catch (err) {
        console.error("Error desactivando usuario:", err);
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  );

  // ============================================
  // 7. ELIMINAR USUARIO
  // ============================================

  app.delete(
    "/api/tenants/:tenantId/users/:userId",
    requireAuth,
    requireTenantAdmin,
    checkPermission("manage_users"),
    async (req: Request, res: Response) => {
      try {
        const actor = (req as any).user;
        const { tenantId, userId } = req.params;

        if (actor.tenantId !== tenantId && actor.role !== "super_admin") {
          return res.status(403).json({ error: "No tienes acceso a este tenant" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.tenantId !== tenantId) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // No permitir eliminar super_admin
        if (user.role === "super_admin") {
          return res.status(403).json({ error: "No puedes eliminar un super_admin" });
        }

        // No permitir auto-eliminación
        if (actor.id === userId) {
          return res.status(403).json({ error: "No puedes eliminarte a ti mismo" });
        }

        await storage.deleteUser(userId);

        await logAudit({
          userId: actor.id,
          action: AuditActions.USER_DELETE,
          ipAddress: getClientIP(req),
          userAgent: getUserAgent(req),
          details: { targetUserId: userId, username: user.username },
        });

        res.json({ message: "Usuario eliminado" });
      } catch (err) {
        console.error("Error eliminando usuario:", err);
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  );

  // ============================================
  // 8. OBTENER MIS PERMISOS (para frontend)
  // ============================================

  app.get(
    "/api/me/permissions",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;

        res.json({
          userId: user.id,
          role: user.role,
          tenantId: user.tenantId,
          permissions: getPermissionsByRole(user.role),
          sucursales_asignadas: user.sucursales_asignadas,
          modulos_habilitados: user.modulos_habilitados,
        });
      } catch (err) {
        console.error("Error obteniendo permisos:", err);
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  );
}
