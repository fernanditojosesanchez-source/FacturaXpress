import type { Express, Request, Response } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSuperAdmin } from "../auth.js";
import { storage } from "../storage.js";

const createTenantSchema = z.object({
	nombre: z.string().min(1, "El nombre es requerido"),
	slug: z
		.string()
		.min(1, "El slug es requerido")
		.regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones"),
	tipo: z.enum(["clinic", "hospital", "lab", "store", "restaurant", "other"]).default("clinic"),
	estado: z.enum(["activo", "prueba", "suspendido"]).default("activo"),
	contactoNombre: z.string().optional(),
	contactoEmail: z.string().email().optional().or(z.literal("")),
	contactoTelefono: z.string().optional(),
	planPago: z.enum(["mensual", "trimestral", "anual", "custom"]).default("mensual"),
	estadoPago: z.enum(["activo", "pendiente", "vencido", "cortesia"]).default("activo"),
	modules: z
		.object({
			facturacion: z.boolean().default(true),
			inventario: z.boolean().default(false),
			reportes: z.boolean().default(true),
			contabilidad: z.boolean().default(false),
			multi_sucursal: z.boolean().default(false),
		})
		.optional(),
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

			const { nombre, slug, tipo, estado, contactoNombre, contactoEmail, contactoTelefono, planPago, estadoPago, modules } = parsed.data;

			const existing = await storage.getTenantBySlug(slug);
			if (existing) {
				return res.status(400).json({ message: "El slug ya está en uso" });
			}

			const tenant = await storage.createTenant(nombre, slug);

			// Generar contraseña segura
			const plainPassword = randomBytes(12).toString("hex");
			const bcrypt = await import("bcrypt");
			const hashedPassword = await bcrypt.hash(plainPassword, 10);

			// Crear usuario tenant_admin con módulos y permisos
			const adminUser = await storage.createUser({
				username: `admin-${slug}`,
				password: hashedPassword,
				tenantId: tenant.id,
				role: "tenant_admin",
			});

			// Actualizar permisos del admin con módulos habilitados
			if (modules) {
				await storage.updateUserPermissions(adminUser.id, {
					modulos_habilitados: modules,
				});
			}

			// Actualizar información de contacto si existe
			if (contactoEmail || contactoNombre || contactoTelefono) {
				const { db } = await import("../db.js");
				const { users } = await import("../../shared/schema.js");
				const { eq } = await import("drizzle-orm");

				await db
					.update(users)
					.set({
						email: contactoEmail || undefined,
						nombre: contactoNombre || undefined,
						telefono: contactoTelefono || undefined,
					})
					.where(eq(users.id, adminUser.id));
			}

			// TODO: Guardar estado, planPago, estadoPago en tabla tenants cuando se agreguen esas columnas

			// Retornar la contraseña en texto plano SOLO una vez al crear
			res.status(201).json({
				tenant,
				adminUser,
				initialPassword: plainPassword,
				config: {
					estado,
					planPago,
					estadoPago,
					modules,
				},
			});
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
				validoHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // Estimado
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

	// ============================================
	// ADMINISTRACIÓN OUTBOX
	// ============================================

	// Obtener estadísticas del outbox
	app.get("/api/admin/outbox/stats", ...requireSuperAdmin, async (_req: Request, res: Response) => {
		try {
			const { getOutboxStats } = await import("../lib/outbox-processor.js");
			const stats = await getOutboxStats();
			res.json(stats);
		} catch (error) {
			console.error("Error getting outbox stats:", error);
			res.status(500).json({ message: "Error al obtener estadísticas del outbox" });
		}
	});

	// Replay manual del outbox hasta una fecha específica
	app.post("/api/admin/outbox/replay", ...requireSuperAdmin, async (req: Request, res: Response) => {
		try {
			const { untilDate } = req.body;

			if (!untilDate) {
				return res.status(400).json({ message: "untilDate es requerido (ISO 8601)" });
			}

			const date = new Date(untilDate);
			if (isNaN(date.getTime())) {
				return res.status(400).json({ message: "Formato de fecha inválido" });
			}

			const { replayOutboxUntil } = await import("../lib/outbox-processor.js");
			await replayOutboxUntil(date);

			res.json({ success: true, message: "Replay completado" });
		} catch (error) {
			console.error("Error replaying outbox:", error);
			res.status(500).json({ message: "Error durante replay del outbox" });
		}
	});

	// === ENDPOINTS DE SCHEMA SYNC ===
	
	// Sincronización manual de schemas
	app.post("/api/admin/schemas/sync", ...requireSuperAdmin, async (_req: Request, res: Response) => {
		try {
			const { syncSchemas } = await import("../lib/schema-sync.js");
			const result = await syncSchemas();
			res.json({
				success: true,
				updated: result.updated,
				errors: result.errors,
			});
		} catch (error) {
			console.error("Error syncing schemas:", error);
			res.status(500).json({ message: "Error sincronizando schemas" });
		}
	});

	// Obtener estadísticas de schemas
	app.get("/api/admin/schemas/stats", ...requireSuperAdmin, async (_req: Request, res: Response) => {
		try {
			const { getSchemaSyncStats } = await import("../lib/schema-sync.js");
			const stats = getSchemaSyncStats();
			res.json(stats);
		} catch (error) {
			console.error("Error getting schema stats:", error);
			res.status(500).json({ message: "Error obteniendo estadísticas" });
		}
	});

	// Listar versiones de schemas
	app.get("/api/admin/schemas/versions", ...requireSuperAdmin, async (_req: Request, res: Response) => {
		try {
			const { listSchemaVersions } = await import("../lib/schema-sync.js");
			const versions = listSchemaVersions();
			res.json(versions);
		} catch (error) {
			console.error("Error listing schema versions:", error);
			res.status(500).json({ message: "Error listando versiones" });
		}
	});

	// Activar versión específica (rollback)
	app.post("/api/admin/schemas/activate", ...requireSuperAdmin, async (req: Request, res: Response) => {
		try {
			const { type, version } = req.body;
			if (!type || !version) {
				return res.status(400).json({ message: "type y version requeridos" });
			}

			const { activateSchemaVersion } = await import("../lib/schema-sync.js");
			const success = await activateSchemaVersion(type, version);
			
			if (success) {
				res.json({ success: true, message: "Schema activado", type, version });
			} else {
				res.status(404).json({ message: "Versión no encontrada" });
			}
		} catch (error) {
			console.error("Error activating schema:", error);
			res.status(500).json({ message: "Error activando schema" });
		}
	});
}

