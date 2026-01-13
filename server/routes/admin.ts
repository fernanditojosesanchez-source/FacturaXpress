import type { Express, Request, Response } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSuperAdmin } from "../auth";
import { storage } from "../storage";

const createTenantSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  slug: z.string().min(1, "El slug es requerido")
    .regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones"),
  tipo: z.enum(["clinic", "hospital", "lab", "store"]).default("clinic"),
});

const updateCredentialsSchema = z.object({
  mhUsuario: z.string().optional(),
  mhPass: z.string().min(1, "Contraseña MH requerida"),
  certificadoP12: z.string().min(1, "Certificado P12 (Base64) requerido"),
  certificadoPass: z.string().min(1, "Contraseña del certificado requerida"),
  ambiente: z.enum(["pruebas", "produccion"]).default("pruebas"),
});

export function registerAdminRoutes(app: Express) {
  
  // Listar todos los tenants
  app.get("/api/admin/tenants", ...requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const tenants = await storage.listTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: "Error al listar tenants" });
    }
  });

  // Crear un nuevo tenant
  app.post("/api/admin/tenants", ...requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createTenantSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const { nombre, slug, tipo } = parsed.data;
      
      const existing = await storage.getTenantBySlug(slug);
      if (existing) {
        return res.status(400).json({ message: "El slug ya está en uso" });
      }

      const tenant = await storage.createTenant(nombre, slug);
      
      // Generar contraseña segura
      const plainPassword = randomBytes(12).toString("hex");
      const bcrypt = await import("bcrypt");
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // Crear usuario tenant_admin por defecto
      const adminUser = await storage.createUser({
        username: `admin-${slug}`,
        password: hashedPassword, 
        tenantId: tenant.id,
        role: "tenant_admin"
      });

      // Retornar la contraseña en texto plano SOLO una vez al crear
      res.status(201).json({ tenant, adminUser, initialPassword: plainPassword });
    } catch (error) {
      console.error("Error creating tenant:", error);
      res.status(500).json({ message: "Error al crear tenant" });
    }
  });

  // Configurar credenciales para un tenant
  app.post("/api/admin/tenants/:id/credentials", ...requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = req.params.id;
      const parsed = updateCredentialsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant no encontrado" });
      }

      await storage.saveTenantCredentials(tenantId, {
        mhUsuario: parsed.data.mhUsuario,
        mhPass: parsed.data.mhPass,
        certificadoP12: parsed.data.certificadoP12,
        certificadoPass: parsed.data.certificadoPass,
        ambiente: parsed.data.ambiente,
        validoHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) // Estimado
      });

      res.json({ success: true, message: "Credenciales actualizadas correctamente" });
    } catch (error) {
      console.error("Error updating credentials:", error);
      res.status(500).json({ message: "Error al actualizar credenciales" });
    }
  });

  // Obtener métricas del sistema
  app.get("/api/admin/metrics", ...requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const metrics = await storage.getSystemMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting metrics:", error);
      res.status(500).json({ message: "Error al obtener métricas" });
    }
  });

  // Suspender/Activar tenant
  app.patch("/api/admin/tenants/:id/status", ...requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = req.params.id;
      const { estado } = req.body;

      if (!["activo", "suspendido"].includes(estado)) {
        return res.status(400).json({ message: "Estado inválido" });
      }

      await storage.updateTenantStatus(tenantId, estado);
      res.json({ success: true, message: `Empresa ${estado === "activo" ? "activada" : "suspendida"} correctamente` });
    } catch (error) {
      console.error("Error updating tenant status:", error);
      res.status(500).json({ message: "Error al actualizar estado" });
    }
  });

  // Eliminar tenant
  app.delete("/api/admin/tenants/:id", ...requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = req.params.id;
      await storage.deleteTenant(tenantId);
      res.json({ success: true, message: "Empresa eliminada correctamente" });
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: "Error al eliminar empresa" });
    }
  });

  // Actualizar información de tenant
  app.patch("/api/admin/tenants/:id", ...requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = req.params.id;
      const { nombre, slug, tipo } = req.body;

      await storage.updateTenant(tenantId, { nombre, slug, tipo });
      res.json({ success: true, message: "Empresa actualizada correctamente" });
    } catch (error) {
      console.error("Error updating tenant:", error);
      res.status(500).json({ message: "Error al actualizar empresa" });
    }
  });
}
