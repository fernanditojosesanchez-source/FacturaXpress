// ============================================
// EJEMPLOS DE USO DEL SISTEMA DE PERMISOS
// ============================================

// En server/routes/users.ts o donde gestiones usuarios:

import { Router, Request, Response } from "express";
import { requireAuth, requireTenantAdmin, requireSuperAdmin } from "../auth";
import { checkPermission, checkBranchAccess, isValidRoleChange } from "../auth";
import { storage } from "../storage";

export const usersRouter = Router();

// ============================================
// 1. LISTAR USUARIOS DEL TENANT (tenant_admin)
// ============================================

usersRouter.get(
  "/api/tenants/:tenantId/users",
  requireAuth,
  requireTenantAdmin,
  checkPermission("manage_users"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { tenantId } = req.params;

    // Verificar que el admin sea del mismo tenant
    if (user.tenantId !== tenantId && user.role !== "super_admin") {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    try {
      const usuarios = await storage.listUsersByTenant(tenantId);
      res.json(usuarios.map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        nombre: u.nombre,
        role: u.role,
        sucursales_asignadas: u.sucursales_asignadas,
        modulos_habilitados: u.modulos_habilitados,
        activo: u.activo,
        ultimo_acceso: u.ultimo_acceso,
      })));
    } catch (err) {
      console.error("Error listando usuarios:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ============================================
// 2. CREAR USUARIO (tenant_admin)
// ============================================

usersRouter.post(
  "/api/tenants/:tenantId/users",
  requireAuth,
  requireTenantAdmin,
  checkPermission("manage_users"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { tenantId } = req.params;
    const { username, email, nombre, password, role, sucursales_asignadas, modulos_habilitados } = req.body;

    // Validación básica
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // Verificar que el admin sea del mismo tenant
    if (user.tenantId !== tenantId && user.role !== "super_admin") {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    // Validar que el rol asignado sea permitido
    const validation = isValidRoleChange(user, role);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.reason });
    }

    try {
      const newUser = await storage.createUser({
        tenantId: tenantId as any,
        username,
        password,
        role,
      });

      // Si hay restricciones de sucursales o módulos, actualizar
      if (sucursales_asignadas || modulos_habilitados) {
        await storage.updateUserPermissions(newUser.id, {
          sucursales_asignadas,
          modulos_habilitados,
        });
      }

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
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ============================================
// 3. ACTUALIZAR PERMISOS DE USUARIO
// ============================================

usersRouter.patch(
  "/api/tenants/:tenantId/users/:userId/permissions",
  requireAuth,
  requireTenantAdmin,
  checkPermission("assign_roles"),
  async (req: Request, res: Response) => {
    const actor = (req as any).user;
    const { tenantId, userId } = req.params;
    const { role, sucursales_asignadas, modulos_habilitados } = req.body;

    // Verificación de acceso
    if (actor.tenantId !== tenantId && actor.role !== "super_admin") {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    // Validar cambio de rol
    if (role) {
      const validation = isValidRoleChange(actor, role);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.reason });
      }
    }

    try {
      // Obtener usuario actual
      const targetUser = await storage.getUser(userId);
      if (!targetUser || targetUser.tenantId !== tenantId) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Actualizar permisos
      await storage.updateUserPermissions(userId, {
        role,
        sucursales_asignadas,
        modulos_habilitados,
      });

      res.json({
        message: "Permisos actualizados",
        role: role || targetUser.role,
        sucursales_asignadas,
        modulos_habilitados,
      });
    } catch (err) {
      console.error("Error actualizando permisos:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ============================================
// 4. EJEMPLO: CREAR FACTURA CON VALIDACIONES
// ============================================

usersRouter.post(
  "/api/tenants/:tenantId/facturas",
  requireAuth,
  checkPermission("create_invoice"),
  checkBranchAccess, // ← Valida sucursal_asignadas si es manager/cashier
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { tenantId } = req.params;
    const { sucursal_id, items, cliente } = req.body;

    // El usuario debe tener permisos
    if (user.tenantId !== tenantId && user.role !== "super_admin") {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    // Si es manager/cashier, el checkBranchAccess middleware verificó sucursal_id
    // Si es tenant_admin, tiene acceso a todas las sucursales

    try {
      // Crear factura...
      res.json({ message: "Factura creada" });
    } catch (err) {
      res.status(500).json({ error: "Error creando factura" });
    }
  }
);

// ============================================
// 5. ELIMINAR USUARIO
// ============================================

usersRouter.delete(
  "/api/tenants/:tenantId/users/:userId",
  requireAuth,
  requireTenantAdmin,
  checkPermission("manage_users"),
  async (req: Request, res: Response) => {
    const actor = (req as any).user;
    const { tenantId, userId } = req.params;

    if (actor.tenantId !== tenantId && actor.role !== "super_admin") {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    try {
      const targetUser = await storage.getUser(userId);
      if (!targetUser || targetUser.tenantId !== tenantId) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // No permitir eliminar super_admin
      if (targetUser.role === "super_admin") {
        return res.status(403).json({ error: "No puedes eliminar un super_admin" });
      }

      await storage.deleteUser(userId);
      res.json({ message: "Usuario eliminado" });
    } catch (err) {
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ============================================
// CASOS DE USO PRÁCTICOS
// ============================================

/*

CASO 1: Crear Dr. Juan con su contador
────────────────────────────────────────

POST /api/tenants/uuid-juan/users
{
  "username": "dr-juan@example.com",
  "password": "...",
  "nombre": "Dr. Juan López",
  "role": "tenant_admin"
}
Response: { id: "user-1", role: "tenant_admin" }

POST /api/tenants/uuid-juan/users
{
  "username": "contador@drjuan.com",
  "password": "...",
  "nombre": "Roberto Contador",
  "role": "accountant"
}
Response: { id: "user-2", role: "accountant" }

POST /api/tenants/uuid-juan/users
{
  "username": "recepcion@drjuan.com",
  "password": "...",
  "nombre": "Recepcionista",
  "role": "sigma_readonly"
}
Response: { id: "user-3", role: "sigma_readonly" }


CASO 2: Ferretería con múltiples sucursales
─────────────────────────────────────────────

POST /api/tenants/uuid-ferreteria/users
{
  "username": "juan@ferreteria.sv",
  "password": "...",
  "nombre": "Juan Dueño",
  "role": "tenant_admin"
}

POST /api/tenants/uuid-ferreteria/users
{
  "username": "gerente.sucursal1@ferreteria.sv",
  "password": "...",
  "nombre": "Gerente Sucursal 1",
  "role": "manager",
  "sucursales_asignadas": ["uuid-sucursal-1"]
}

POST /api/tenants/uuid-ferreteria/users
{
  "username": "gerente.sucursal2@ferreteria.sv",
  "password": "...",
  "nombre": "Gerente Sucursal 2",
  "role": "manager",
  "sucursales_asignadas": ["uuid-sucursal-2"]
}

POST /api/tenants/uuid-ferreteria/users (Múltiples veces para cada cajero)
{
  "username": "cajero1@ferreteria.sv",
  "password": "...",
  "nombre": "Cajero 1",
  "role": "cashier",
  "sucursales_asignadas": ["uuid-sucursal-1"]
}


CASO 3: Actualizar permisos
──────────────────────────

PATCH /api/tenants/uuid-juan/users/user-2/permissions
{
  "role": "accountant",
  "modulos_habilitados": {
    "facturacion": false,
    "inventario": false,
    "reportes": true,
    "contabilidad": true,
    "multi_sucursal": false
  }
}

*/
