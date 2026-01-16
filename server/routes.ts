import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage.js";
import { emisorSchema, insertFacturaSchema, insertProductoSchema, receptorSchema, insertCertificadoSchema } from "../shared/schema.js";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { mhService } from "./mh-service.js";
import { generarFacturasPrueba, EMISOR_PRUEBA } from "./seed-data.js";
import { requireAuth, requireTenantAdmin, requireManager, requireApiKey, registerAuthRoutes, checkPermission } from "./auth.js";
import * as catalogs from "./catalogs.js";
import { validateDTESchema } from "./dgii-validator.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerUserRoutes } from "./routes/users.js";
import { facturaCreationRateLimiter, transmisionRateLimiter } from "./lib/rate-limiters.js";
import { logAudit, AuditActions, getClientIP, getUserAgent } from "./lib/audit.js";
import { sql } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Rutas de autenticación
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerUserRoutes(app);

  // Helper para obtener tenantId del request
  const getTenantId = (req: Request) => (req as any).user?.tenantId;

  // Helper para autenticación dual (Cookie o API Key)
  const requireAuthOrApiKey = (req: Request, res: Response, next: any) => {
    const hasAuthCookie = req.headers.cookie?.includes("accessToken");
    const hasApiKey = req.headers["x-api-key"] || req.headers["authorization"];
    
    if (hasApiKey && !hasAuthCookie) {
      return requireApiKey(req, res, next);
    }
    return requireAuth(req, res, next);
  };

  // ============================================
  // HEALTH CHECK & MONITOREO
  // ============================================

  /**
   * Health check general del sistema
   * GET /api/health
   * 
   * Retorna:
   * - status: "ok" | "degraded" | "error"
   * - mhStatus: Estado del Circuit Breaker de MH
   * - timestamp: ISO 8601
   */
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      // Obtener estado del Circuit Breaker de MH
      const mhServiceWithBreaker = mhService as any;
      const mhCircuitState = mhServiceWithBreaker.getCircuitState?.();

      // Stats de colas (si están disponibles)
      let queuesHealth: any = { enabled: false };
      try {
        const { getQueuesStats } = await import("./lib/queues.js");
        const stats = await getQueuesStats();
        if (stats.length > 0) {
          queuesHealth = {
            enabled: true,
            queues: stats,
          };
        }
      } catch (err) {
        // Ignorar si las colas no están disponibles
      }

      const healthStatus = {
        status: mhCircuitState?.state === "OPEN" ? "degraded" : "ok",
        timestamp: new Date().toISOString(),
        services: {
          mh: {
            circuitState: mhCircuitState?.state || "unknown",
            failureCount: mhCircuitState?.failureCount || 0,
            nextRetryIn: mhCircuitState?.nextRetryIn || null,
            backoffMultiplier: mhCircuitState?.backoffMultiplier || 1
          },
          queues: queuesHealth
        }
      };

      const statusCode = healthStatus.status === "ok" ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: "Error al obtener estado del sistema",
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Health check detallado (requiere autenticación admin)
   * GET /api/health/detailed
   * 
   * Retorna información completa del sistema para monitoreo
   */
  app.get("/api/health/detailed", requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const mhServiceWithBreaker = mhService as any;
      const mhCircuitState = mhServiceWithBreaker.getCircuitState?.();

      const detailedStatus = {
        status: mhCircuitState?.state === "OPEN" ? "degraded" : "ok",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        services: {
          mh: {
            circuitState: mhCircuitState?.state || "unknown",
            failureCount: mhCircuitState?.failureCount || 0,
            successCount: mhCircuitState?.successCount || 0,
            nextRetryIn: mhCircuitState?.nextRetryIn || null,
            backoffMultiplier: mhCircuitState?.backoffMultiplier || 1,
            description: mhCircuitState?.state === "OPEN" 
              ? "MH está caído. Facturas se encolan en contingencia"
              : mhCircuitState?.state === "HALF_OPEN"
              ? "Probando recuperación de MH"
              : "MH funciona normalmente"
          }
        }
      };

      res.json(detailedStatus);
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: "Error al obtener estado detallado",
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Endpoint de métricas Prometheus
   * GET /metrics
   * 
   * Exporta métricas de colas BullMQ en formato Prometheus
   */
  app.get("/metrics", async (req: Request, res: Response) => {
    try {
      const { getQueues } = await import("./lib/queues.js");
      const { getQueueMetrics, formatPrometheusMetrics } = await import("./lib/metrics.js");
      const { transmisionQueue, firmaQueue, notificacionesQueue } = getQueues();
      const allMetrics: any[] = [];

      if (transmisionQueue) {
        allMetrics.push(await getQueueMetrics(transmisionQueue));
      }
      if (firmaQueue) {
        allMetrics.push(await getQueueMetrics(firmaQueue));
      }
      if (notificacionesQueue) {
        allMetrics.push(await getQueueMetrics(notificacionesQueue));
      }

      if (allMetrics.length === 0) {
        return res.status(503).send("# No queues available\n");
      }

      const prometheusFormat = formatPrometheusMetrics(allMetrics);
      res.setHeader("Content-Type", "text/plain; version=0.0.4");
      res.send(prometheusFormat);
    } catch (err: any) {
      res.status(500).send(`# Error: ${err.message}\n`);
    }
  });

  // ============================================
  // ENDPOINTS DE CATÁLOGOS DGII (Públicos/Globales)
  // ============================================

  app.get("/api/catalogos/departamentos", (_req: Request, res: Response) => {
    try {
      return res.json(catalogs.DEPARTAMENTOS_EL_SALVADOR || []);
    } catch (error) {
      return res.status(500).json({ message: "Error al cargar departamentos" });
    }
  });

  app.get("/api/catalogos/tipos-documento", (_req: Request, res: Response) => {
    return res.json(catalogs.TIPOS_DOCUMENTO || []);
  });

  app.get("/api/catalogos/tipos-dte", (_req: Request, res: Response) => {
    return res.json(catalogs.TIPOS_DTE || []);
  });

  app.get("/api/catalogos/condiciones-operacion", (_req: Request, res: Response) => {
    return res.json(catalogs.CONDICIONES_OPERACION || []);
  });

  app.get("/api/catalogos/formas-pago", (_req: Request, res: Response) => {
    return res.json(catalogs.FORMAS_PAGO || []);
  });

  app.get("/api/catalogos/tipos-item", (_req: Request, res: Response) => {
    return res.json(catalogs.TIPOS_ITEM || []);
  });

  app.get("/api/catalogos/unidades-medida", (_req: Request, res: Response) => {
    return res.json(catalogs.UNIDADES_MEDIDA || []);
  });

  app.get("/api/catalogos/all", (_req: Request, res: Response) => {
    try {
      return res.json({
        departamentos: catalogs.DEPARTAMENTOS_EL_SALVADOR || [],
        tiposDocumento: catalogs.TIPOS_DOCUMENTO || [],
        tiposDte: catalogs.TIPOS_DTE || [],
        condicionesOperacion: catalogs.CONDICIONES_OPERACION || [],
        formasPago: catalogs.FORMAS_PAGO || [],
        tiposItem: catalogs.TIPOS_ITEM || [],
        unidadesMedida: catalogs.UNIDADES_MEDIDA || [],
      });
    } catch (error: any) {
      console.error("Error en /api/catalogos/all:", error);
      return res.status(500).json({ message: "Error al cargar catálogos", details: error.message });
    }
  });

  // ============================================
  // ENDPOINTS DE ESTADÍSTICAS
  // ============================================

  app.get("/api/stats/dashboard", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const facturas = await storage.getFacturas(tenantId);
      
      const today = new Date().toISOString().split("T")[0];
      const mesActual = new Date().toISOString().slice(0, 7);
      
      const stats = {
        totalInvoices: facturas.length,
        hoy: facturas.filter((f: any) => f.fecEmi === today).length,
        pendientes: facturas.filter((f: any) => f.estado === "generada").length,
        selladas: facturas.filter((f: any) => f.estado === "sellada").length,
        totalVentas: facturas.reduce((sum: number, f: any) => sum + f.resumen.totalPagar, 0),
        outstanding: facturas
          .filter((f: any) => f.estado === "generada")
          .reduce((sum: number, f: any) => sum + f.resumen.totalPagar, 0),
        ventasEsteMes: facturas
          .filter((f: any) => f.fecEmi.startsWith(mesActual))
          .reduce((sum: number, f: any) => sum + f.resumen.totalPagar, 0),
        recentInvoices: facturas.slice(0, 5)
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  // ============================================
  // ENDPOINTS DE RECEPTORES (Clientes)
  // ============================================


  app.get("/api/receptores", requireAuth, checkPermission("manage_clients"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ error: "Parámetros de paginación inválidos" });
      }
      
      const offset = (page - 1) * limit;
      
      const receptores = await storage.getReceptores(tenantId);
      const total = receptores.length;
      const paginated = receptores.slice(offset, offset + limit);
      
      res.json({
        data: paginated,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener clientes" });
    }
  });

  app.get("/api/receptores/:doc", requireAuth, checkPermission("manage_clients"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const receptor = await storage.getReceptorByDoc(tenantId, req.params.doc);
      if (!receptor) return res.status(404).json({ error: "Cliente no encontrado" });
      res.json(receptor);
    } catch (error) {
      res.status(500).json({ error: "Error al buscar cliente" });
    }
  });

  app.post("/api/receptores", requireAuth, checkPermission("manage_clients"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = receptorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      await storage.upsertReceptor(tenantId, parsed.data);
      res.status(201).json({ success: true, receptor: parsed.data });
    } catch (error: any) {
      if (error.message?.includes("unique")) {
        return res.status(409).json({ error: "Ya existe un cliente con este número de documento" });
      }
      res.status(500).json({ error: "Error al crear cliente" });
    }
  });

  app.patch("/api/receptores/:id", requireAuth, checkPermission("manage_clients"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = receptorSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const receptor = await storage.updateReceptor(req.params.id, tenantId, parsed.data);
      if (!receptor) return res.status(404).json({ error: "Cliente no encontrado" });
      res.json(receptor);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar cliente" });
    }
  });

  app.delete("/api/receptores/:id", requireAuth, checkPermission("manage_clients"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const deleted = await storage.deleteReceptor(req.params.id, tenantId);
      if (!deleted) return res.status(404).json({ error: "Cliente no encontrado" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar cliente" });
    }
  });

  // ============================================
  // ENDPOINTS DE PRODUCTOS / SERVICIOS
  // ============================================

  app.get("/api/productos", requireAuth, checkPermission("manage_products"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ error: "Parámetros de paginación inválidos" });
      }
      
      const offset = (page - 1) * limit;
      
      const productos = await storage.getProductos(tenantId);
      const total = productos.length;
      const paginated = productos.slice(offset, offset + limit);
      
      res.json({
        data: paginated,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener productos" });
    }
  });

  app.get("/api/productos/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const producto = await storage.getProducto(req.params.id, tenantId);
      if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
      res.json(producto);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener producto" });
    }
  });

  app.post("/api/productos", requireAuth, checkPermission("manage_products"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = insertProductoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const producto = await storage.createProducto(tenantId, parsed.data);
      res.status(201).json(producto);
    } catch (error) {
      res.status(500).json({ error: "Error al crear producto" });
    }
  });

  app.patch("/api/productos/:id", requireAuth, checkPermission("manage_products"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const producto = await storage.updateProducto(req.params.id, tenantId, req.body);
      if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
      res.json(producto);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar producto" });
    }
  });

  app.delete("/api/productos/:id", requireAuth, checkPermission("manage_products"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const deleted = await storage.deleteProducto(req.params.id, tenantId);
      if (!deleted) return res.status(404).json({ error: "Producto no encontrado" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar producto" });
    }
  });

  // ============================================
  // ENDPOINTS DE CERTIFICADOS DIGITALES
  // ============================================

  app.get("/api/certificados", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ error: "Parámetros de paginación inválidos" });
      }
      
      const offset = (page - 1) * limit;
      
      const certificados = await storage.getCertificados(tenantId) || [];
      if (!Array.isArray(certificados)) {
        throw new Error("El almacenamiento no devolvió un arreglo de certificados");
      }
      
      const total = certificados.length;
      const paginated = certificados.slice(offset, offset + limit);
      
      res.json({
        data: paginated,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("Error en GET /api/certificados:", error);
      res.status(500).json({ 
        error: "Error al obtener certificados", 
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined 
      });
    }
  });

  app.get("/api/certificados/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const certificado = await storage.getCertificado(req.params.id, tenantId);
      if (!certificado) return res.status(404).json({ error: "Certificado no encontrado" });
      res.json(certificado);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener certificado" });
    }
  });

  app.post("/api/certificados", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = insertCertificadoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      // Calcular huella del certificado (fingerprint SHA-256)
      // En producción, usar crypto para extraer del P12
      const crypto = await import("crypto");
      const huella = crypto
        .createHash("sha256")
        .update(JSON.stringify(parsed.data))
        .digest("hex");

      const certificado = await storage.createCertificado(tenantId, {
        ...parsed.data,
        huella,
      });
      
      res.status(201).json(certificado);
    } catch (error: any) {
      if (error.message?.includes("unique constraint")) {
        return res.status(409).json({ error: "El certificado ya existe (huella duplicada)" });
      }
      res.status(500).json({ error: "Error al crear certificado" });
    }
  });

  app.patch("/api/certificados/:id", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const certificado = await storage.updateCertificado(req.params.id, tenantId, req.body);
      if (!certificado) return res.status(404).json({ error: "Certificado no encontrado" });
      res.json(certificado);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar certificado" });
    }
  });

  app.delete("/api/certificados/:id", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const deleted = await storage.deleteCertificado(req.params.id, tenantId);
      if (!deleted) return res.status(404).json({ error: "Certificado no encontrado" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar certificado" });
    }
  });

  app.post("/api/certificados/:id/validar", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const certificado = await storage.getCertificado(req.params.id, tenantId);
      if (!certificado) return res.status(404).json({ error: "Certificado no encontrado" });

      // Validar certificado (en producción, usar librería de X.509)
      const ahora = new Date();
      const errores: Record<string, string> = {};

      if (certificado.validoHasta && new Date(certificado.validoHasta) < ahora) {
        errores["expirado"] = "El certificado ha expirado";
      }
      if (certificado.validoDesde && new Date(certificado.validoDesde) > ahora) {
        errores["no_valido_aun"] = "El certificado aún no es válido";
      }

      const esValido = Object.keys(errores).length === 0;
      const resultado = await storage.updateCertificado(req.params.id, tenantId, {
        certificadoValido: esValido,
        estado: esValido ? "validado" : "pendiente",
        erroresValidacion: errores,
        ultimaValidacion: new Date(),
      });

      res.json(resultado);
    } catch (error) {
      res.status(500).json({ error: "Error al validar certificado" });
    }
  });

  app.post("/api/certificados/:id/activar", requireAuth, requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { db } = await import("./db.js");
      
      // Desactivar todos los demás certificados
      await db.execute(
        sql`UPDATE certificados SET activo = false WHERE tenant_id = ${tenantId} AND id != ${req.params.id}`
      );

      // Activar el certificado seleccionado
      const certificado = await storage.updateCertificado(req.params.id, tenantId, {
        activo: true,
        estado: "activo",
      });

      if (!certificado) return res.status(404).json({ error: "Certificado no encontrado" });
      res.json(certificado);
    } catch (error) {
      res.status(500).json({ error: "Error al activar certificado" });
    }
  });

  // ============================================
  // VALIDACIÓN DTE CONTRA SCHEMA DGII
  // ============================================
  app.post("/api/validar-dte", requireAuth, (req: Request, res: Response) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          valid: false,
          errors: [{ field: "root", message: "Request body must be a JSON object" }]
        });
      }

      const dteValidation = validateDTESchema(req.body);
      
      if (dteValidation.valid) {
        return res.json({ 
          valid: true, 
          message: "DTE válido según schema DGII" 
        });
      } else {
        return res.status(400).json({
          valid: false,
          errors: dteValidation.errors
        });
      }
    } catch (error) {
      console.error("[validar-dte] Error:", error);
      return res.status(500).json({ 
        error: "Error al validar DTE",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // ============================================
  // ENDPOINTS DE EMISOR (Configuración por Tenant)
  // ============================================

  app.get("/api/emisor", ...requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const emisor = await storage.getEmisor(tenantId);
      if (!emisor) {
        return res.json({});
      }
      res.json(emisor);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener datos del emisor" });
    }
  });

  app.post("/api/emisor", ...requireTenantAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const parsed = emisorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const emisor = await storage.saveEmisor(tenantId, parsed.data);
      res.json(emisor);
    } catch (error) {
      res.status(500).json({ error: "Error al guardar datos del emisor" });
    }
  });

  // ============================================
  // ENDPOINTS DE FACTURACIÓN (DTEs por Tenant)
  // ============================================

  app.get("/api/facturas", requireAuth, checkPermission("view_invoices"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const facturas = await storage.getFacturas(tenantId);
      
      // Si se solicita explícitamente sin paginación (ej: para reportes)
      if (req.query.limit === "all") {
        return res.json({
          data: facturas,
          pagination: {
            page: 1,
            limit: facturas.length,
            total: facturas.length,
            pages: 1,
          },
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      
      if (page < 1 || limit < 1 || limit > 500) {
        return res.status(400).json({ error: "Parámetros de paginación inválidos" });
      }
      
      const offset = (page - 1) * limit;
      const total = facturas.length;
      const paginated = facturas.slice(offset, offset + limit);
      
      res.json({
        data: paginated,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener facturas" });
    }
  });

  app.get("/api/facturas/:id", requireAuth, checkPermission("view_invoices"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const factura = await storage.getFactura(req.params.id, tenantId);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }
      res.json(factura);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener factura" });
    }
  });

  app.post("/api/facturas", 
    requireAuthOrApiKey, 
    facturaCreationRateLimiter,
    checkPermission("create_invoice"),
    async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = (req as any).user?.id;
      const ipAddress = getClientIP(req);
      
      const parsed = insertFacturaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validación fallida",
          details: parsed.error.errors 
        });
      }

      // Validar unicidad de código generación por tenant
      const codigoGen = parsed.data.codigoGeneracion;
      if (codigoGen) {
        const existente = await storage.getFacturaByCodigoGeneracion(codigoGen, tenantId);
        if (existente) {
          return res.status(400).json({
            error: "Código de generación ya existe",
            codigo: "DUPLICADO_CODIGO_GEN"
          });
        }
      }

      // Generar número de control en servidor usando tenantId
      const emisorNit = parsed.data.emisor?.nit || "00000000000000-0";
      const tipoDte = parsed.data.tipoDte || "01";
      const numeroControl = await storage.getNextNumeroControl(tenantId, emisorNit, tipoDte);
      const codigoGeneracion = parsed.data.codigoGeneracion || randomUUID().toUpperCase();
      
      const facturaConNumero = {
        ...parsed.data,
        numeroControl,
        codigoGeneracion,
        tenantId,
        externalId: parsed.data.externalId || undefined,
      };

      // Validación DGII Schema
      const dteValidation = validateDTESchema(facturaConNumero);
      if (!dteValidation.valid) {
        return res.status(400).json({
          error: "Validación DGII fallida",
          dgiiErrors: dteValidation.errors
        });
      }

      const factura = await storage.createFactura(tenantId, facturaConNumero);
      
      // ✅ NUEVO: Guardar automáticamente al cliente en el catálogo
      if (facturaConNumero.receptor) {
        await storage.upsertReceptor(tenantId, facturaConNumero.receptor);
      }

      // Auditoría
      await logAudit({ 
        userId, 
        action: AuditActions.FACTURA_CREATED, 
        ipAddress, 
        userAgent: getUserAgent(req),
        details: { facturaId: factura.id, codigoGeneracion: factura.codigoGeneracion }
      });

      res.status(201).json(factura);
    } catch (error) {
      console.error("Error creating factura:", error);
      res.status(500).json({ error: "Error al crear factura" });
    }
  });

  app.patch("/api/facturas/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const factura = await storage.updateFactura(req.params.id, tenantId, req.body);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada o sin permiso" });
      }
      res.json(factura);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar factura" });
    }
  });

  app.delete("/api/facturas/:id", ...requireManager, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const deleted = await storage.deleteFactura(req.params.id, tenantId);
      if (!deleted) {
        return res.status(404).json({ error: "Factura no encontrada o sin permiso" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar factura" });
    }
  });

  app.get("/api/facturas/:id/pdf", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const factura = await storage.getFactura(req.params.id, tenantId);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("DOCUMENTO TRIBUTARIO ELECTRONICO", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Tipo: ${factura.tipoDte === "01" ? "FACTURA" : "DTE-" + factura.tipoDte}`, pageWidth / 2, 28, { align: "center" });
      
      doc.setFontSize(10);
      doc.text(`Número de Control: ${factura.numeroControl}`, 15, 40);
      doc.text(`Código de Generación: ${factura.codigoGeneracion}`, 15, 46);
      doc.text(`Fecha: ${factura.fecEmi} ${factura.horEmi}`, 15, 52);
      
      doc.setFont("helvetica", "bold");
      doc.text("EMISOR:", 15, 64);
      doc.setFont("helvetica", "normal");
      doc.text(factura.emisor.nombre, 15, 70);
      doc.text(`NIT: ${factura.emisor.nit}`, 15, 76);
      doc.text(`NRC: ${factura.emisor.nrc}`, 15, 82);
      doc.text(`${factura.emisor.direccion.complemento}`, 15, 88);
      
      doc.setFont("helvetica", "bold");
      doc.text("RECEPTOR:", 110, 64);
      doc.setFont("helvetica", "normal");
      doc.text(factura.receptor.nombre, 110, 70);
      doc.text(`Doc: ${factura.receptor.numDocumento}`, 110, 76);
      if (factura.receptor.nrc) {
        doc.text(`NRC: ${factura.receptor.nrc}`, 110, 82);
      }
      doc.text(`${factura.receptor.direccion.complemento}`, 110, 88, { maxWidth: 80 });
      
      doc.setFont("helvetica", "bold");
      doc.text("DETALLE:", 15, 105);
      
      doc.setFillColor(240, 240, 240);
      doc.rect(15, 110, pageWidth - 30, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Cant.", 17, 115);
      doc.text("Descripción", 35, 115);
      doc.text("P. Unit.", 130, 115);
      doc.text("Total", 165, 115);
      
      doc.setFont("helvetica", "normal");
      let yPos = 125;
      factura.cuerpoDocumento.forEach((item: any) => {
        doc.text(item.cantidad.toString(), 17, yPos);
        doc.text(item.descripcion.substring(0, 50), 35, yPos);
        doc.text(`$${item.precioUni.toFixed(2)}`, 130, yPos);
        doc.text(`$${item.ventaGravada.toFixed(2)}`, 165, yPos);
        yPos += 7;
      });
      
      yPos += 10;
      doc.line(15, yPos - 5, pageWidth - 15, yPos - 5);
      
      doc.setFont("helvetica", "normal");
      doc.text("Subtotal:", 130, yPos);
      doc.text(`$${factura.resumen.subTotal.toFixed(2)}`, 165, yPos);
      yPos += 7;
      
      doc.text("IVA (13%):", 130, yPos);
      doc.text(`$${factura.resumen.totalIva.toFixed(2)}`, 165, yPos);
      yPos += 7;
      
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL A PAGAR:", 130, yPos);
      doc.text(`$${factura.resumen.totalPagar.toFixed(2)}`, 165, yPos);
      yPos += 10;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`SON: ${factura.resumen.totalLetras}`, 15, yPos);
      
      try {
        const qrData = JSON.stringify({
          codigoGeneracion: factura.codigoGeneracion,
          numeroControl: factura.numeroControl,
          fecEmi: factura.fecEmi,
          totalPagar: factura.resumen.totalPagar,
        });
        
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 80, margin: 1 });
        doc.addImage(qrDataUrl, "PNG", 15, yPos + 10, 35, 35);
      } catch (qrError) {
        console.error("Error generating QR code:", qrError);
      }
      
      const pdfBuffer = doc.output("arraybuffer");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=DTE-${factura.numeroControl}.pdf`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Error al generar PDF" });
    }
  });

  // ============================================
  // ENDPOINTS DE INTEGRACIÓN MH
  // ============================================
  
  app.post("/api/facturas/:id/transmitir", requireAuth, checkPermission("transmit_invoice"), transmisionRateLimiter, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = (req as any).user?.id;
      const ipAddress = getClientIP(req);
      
      const factura = await storage.getFactura(req.params.id, tenantId);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      if (factura.estado === "transmitida" || factura.estado === "sellada") {
        return res.status(400).json({ error: "Esta factura ya fue transmitida" });
      }

      // Verificar disponibilidad del MH
      const mhDisponible = await mhService.verificarDisponibilidad();
      
      if (!mhDisponible) {
        // MH no disponible - Agregar a cola de contingencia
        console.log(`[Contingencia] MH no disponible. Agregando DTE ${factura.codigoGeneracion} a cola...`);
        await storage.addToContingenciaQueue(tenantId, req.params.id, factura.codigoGeneracion || "");
        
        await logAudit({
          userId,
          action: AuditActions.CONTINGENCIA_ADDED,
          ipAddress,
          userAgent: getUserAgent(req),
          details: { facturaId: req.params.id, codigoGeneracion: factura.codigoGeneracion }
        });
        
        return res.status(202).json({ 
          success: false,
          mensaje: "Ministerio de Hacienda no disponible. DTE guardado en cola de contingencia.",
          estado: "pendiente_contingencia",
          codigoGeneracion: factura.codigoGeneracion
        });
      }

      // Transmitir al MH pasando el tenantId para usar sus credenciales
      const sello = await mhService.transmitirDTE(factura, tenantId);

      // Actualizar factura
      const nuevoEstado = sello.estado === "PROCESADO" ? "sellada" : "generada";
      const facturaActualizada = await storage.updateFactura(req.params.id, tenantId, {
        selloRecibido: sello.selloRecibido,
        estado: nuevoEstado
      });

      // Auditoría
      await logAudit({
        userId,
        action: AuditActions.FACTURA_TRANSMITTED,
        ipAddress,
        userAgent: getUserAgent(req),
        details: { 
          facturaId: req.params.id, 
          codigoGeneracion: factura.codigoGeneracion,
          selloRecibido: sello.selloRecibido,
          estado: nuevoEstado
        }
      });

      res.json({ 
        success: sello.estado === "PROCESADO",
        sello,
        factura: facturaActualizada 
      });
    } catch (error) {
      console.error("Error al transmitir factura:", error);
      
      // Si error es de conexión, agregar a contingencia
      const errorMsg = error instanceof Error ? error.message : "Error desconocido";
      if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("ETIMEDOUT") || errorMsg.includes("ENOTFOUND")) {
        const factura = await storage.getFactura(req.params.id, getTenantId(req));
        if (factura && factura.codigoGeneracion) {
          await storage.addToContingenciaQueue(getTenantId(req), req.params.id, factura.codigoGeneracion);
          return res.status(202).json({
            success: false,
            mensaje: "Error de conexión. DTE agregado a cola de contingencia.",
            estado: "pendiente_contingencia",
            error: errorMsg
          });
        }
      }
      
      res.status(500).json({ 
        error: errorMsg
      });
    }
  });

  app.get("/api/mh/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const conectado = await mhService.verificarConexion(tenantId);
      const mockMode = process.env.MH_MOCK_MODE === "true" || !process.env.MH_API_TOKEN;
      
      res.json({
        conectado,
        modoSimulacion: mockMode,
        mensaje: mockMode 
          ? "Modo simulación activo"
          : conectado 
            ? "Conectado al MH"
            : "Sin conexión al MH"
      });
    } catch (error) {
      res.status(500).json({ conectado: false, error: "Error de estado MH" });
    }
  });

  app.get("/api/facturas/:id/estado-mh", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const factura = await storage.getFactura(req.params.id, tenantId);
      if (!factura) return res.status(404).json({ error: "No encontrada" });

      const estado = await mhService.consultarEstado(factura.codigoGeneracion || "", tenantId);
      res.json(estado);
    } catch (error) {
      res.status(500).json({ error: "Error al consultar MH" });
    }
  });

  // ============================================
  // ENDPOINTS DE INVALIDACIÓN (Anulación de DTEs)
  // ============================================

  app.post("/api/facturas/:id/invalidar", requireAuth, checkPermission("invalidate_invoice"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = (req as any).userId || (req as any).user?.id || "system";
      const { motivo, observaciones } = req.body;

      if (!motivo) {
        return res.status(400).json({ error: "Motivo de invalidación es requerido" });
      }

      const factura = await storage.getFactura(req.params.id, tenantId);
      if (!factura) {
        return res.status(404).json({ error: "Factura no encontrada" });
      }

      if (!factura.codigoGeneracion) {
        return res.status(400).json({ error: "Factura no tiene código de generación" });
      }

      // Validar que el motivo sea válido según DGII
      const motivosValidos = ["01", "02", "03", "04", "05"];
      if (!motivosValidos.includes(motivo)) {
        return res.status(400).json({ 
          error: "Motivo inválido. Válidos: 01-05",
          motivosValidos: {
            "01": "Anulación por error",
            "02": "Anulación por contingencia",
            "03": "Anulación por cambio de operación",
            "04": "Anulación por cambio de referencia",
            "05": "Anulación por cambio de datos"
          }
        });
      }

      // Crear registro de anulación
      await storage.crearAnulacion(
        tenantId,
        req.params.id,
        factura.codigoGeneracion,
        motivo,
        userId,
        observaciones
      );

      // Intentar invalidar inmediatamente
      try {
        const resultado = await mhService.invalidarDTE(
          factura.codigoGeneracion,
          motivo,
          tenantId
        );

        if (resultado.success) {
          await storage.updateAnulacionStatus(
            factura.codigoGeneracion,
            "aceptado",
            resultado.selloAnulacion,
            { fechaAnulo: resultado.fechaAnulo }
          );

          // Actualizar factura a anulada
          await storage.updateFactura(req.params.id, tenantId, {
            estado: "anulada"
          });

          return res.json({
            success: true,
            mensaje: "DTE invalidado correctamente",
            selloAnulacion: resultado.selloAnulacion,
            estado: "aceptado"
          });
        }
      } catch (error) {
        // Si falla, marcar como pendiente para reintento
        const errorMsg = error instanceof Error ? error.message : "Error desconocido";
        await storage.updateAnulacionStatus(
          factura.codigoGeneracion,
          "pendiente",
          undefined,
          undefined,
          errorMsg
        );

        return res.status(202).json({
          success: false,
          mensaje: "Anulación guardada en cola (MH no disponible)",
          estado: "pendiente",
          error: errorMsg
        });
      }
    } catch (error) {
      console.error("Error al invalidar factura:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Error al invalidar"
      });
    }
  });

  app.get("/api/anulaciones/pendientes", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const pendientes = await storage.getAnulacionesPendientes(tenantId);
      
      res.json({
        total: pendientes.length,
        anulaciones: pendientes
      });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener anulaciones pendientes" });
    }
  });

  app.get("/api/anulaciones/historico", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      const historico = await storage.getHistoricoAnulaciones(tenantId, limit);
      res.json({
        total: historico.length,
        anulaciones: historico
      });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener histórico de anulaciones" });
    }
  });

  // Procesar la cola de anulaciones pendientes
  app.post("/api/anulaciones/procesar", requireAuth, checkPermission("invalidate_invoice"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const pendientes = await storage.getAnulacionesPendientes(tenantId);

      const resultados: Array<{ codigoGeneracion: string; estado: string; selloAnulacion?: string; error?: string }> = [];

      for (const item of pendientes) {
        try {
          const resultado = await mhService.invalidarDTE(
            item.codigoGeneracion,
            item.motivo,
            tenantId
          );

          if (resultado.success) {
            await storage.updateAnulacionStatus(
              item.codigoGeneracion,
              "aceptado",
              resultado.selloAnulacion,
              { fechaAnulo: resultado.fechaAnulo }
            );

            // Marcar la factura como anulada
            await storage.updateFactura(item.facturaId, tenantId, {
              estado: "anulada",
            });

            resultados.push({
              codigoGeneracion: item.codigoGeneracion,
              estado: "aceptado",
              selloAnulacion: resultado.selloAnulacion,
            });
          } else {
            // No aceptado por MH
            const errorMsg = "MH no aceptó la anulación";
            await storage.updateAnulacionStatus(item.codigoGeneracion, "pendiente", undefined, undefined, errorMsg);
            resultados.push({ codigoGeneracion: item.codigoGeneracion, estado: "pendiente", error: errorMsg });
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : "Error al procesar anulación";
          await storage.updateAnulacionStatus(item.codigoGeneracion, "pendiente", undefined, undefined, errorMsg);
          resultados.push({ codigoGeneracion: item.codigoGeneracion, estado: "pendiente", error: errorMsg });
        }
      }

      res.json({
        totalProcesados: resultados.length,
        resultados,
      });
    } catch (error) {
      console.error("Error al procesar anulaciones:", error);
      res.status(500).json({ error: "Error al procesar anulaciones pendientes" });
    }
  });

  app.post("/api/anulaciones/procesar", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      console.log(`[API] Procesando anulaciones pendientes para tenant ${tenantId}...`);
      
      await mhService.procesarAnulacionesPendientes(tenantId);
      
      const pendientes = await storage.getAnulacionesPendientes(tenantId);
      res.json({
        success: true,
        mensaje: "Anulaciones procesadas",
        aunPendientes: pendientes.length
      });
    } catch (error) {
      console.error("Error procesando anulaciones:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Error al procesar anulaciones"
      });
    }
  });

  // ============================================
  // REPORTES CONTABLES (Libro de Ventas / IVA)
  // ============================================

  app.get("/api/reportes/iva-mensual", requireAuth, checkPermission("view_reports"), async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const { mes, anio } = req.query;

      const now = new Date();
      const targetMonth = mes ? parseInt(mes as string) : now.getMonth() + 1;
      const targetYear = anio ? parseInt(anio as string) : now.getFullYear();

      // Rango de fechas para el mes seleccionado
      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

      // Consulta SQL nativa (optimizada) para obtener resumen sin traer todas las facturas
      // Nota: Drizzle query builder puede usarse, pero SQL crudo a veces es más claro para reportes complejos
      // Aquí simulamos la lógica usando filtrado en memoria SOLO de las facturas del rango de fechas
      // (Idealmente esto sería un SELECT SUM(...) FROM facturas WHERE date BETWEEN ...)
      
      const facturas = await storage.getFacturas(tenantId);
      
      // Filtrado optimizado: Primero por fecha en DB (si storage lo soportara)
      // Como storage.getFacturas trae todo, aquí filtramos.
      // TODO: Implementar getFacturasByDateRange en storage.ts para verdadera optimización SQL.
      
      const facturasDelMes = facturas.filter(f => {
        if (f.estado !== "sellada") return false;
        const fecha = new Date(f.fecEmi); 
        return fecha >= startDate && fecha <= endDate;
      });

      const reporte = {
        periodo: `${targetMonth}/${targetYear}`,
        totalFacturas: facturasDelMes.length,
        ventasGravadas: facturasDelMes.reduce((sum, f) => sum + (f.resumen.totalGravada || 0), 0),
        ventasExentas: facturasDelMes.reduce((sum, f) => sum + (f.resumen.totalExenta || 0), 0),
        totalIva: facturasDelMes.reduce((sum, f) => sum + (f.resumen.totalIva || 0), 0),
        totalVentas: facturasDelMes.reduce((sum, f) => sum + (f.resumen.totalPagar || 0), 0),
        detalle: facturasDelMes.map(f => ({
          fecha: f.fecEmi,
          numero: f.numeroControl,
          cliente: f.receptor.nombre,
          gravado: f.resumen.totalGravada,
          iva: f.resumen.totalIva,
          total: f.resumen.totalPagar
        }))
      };

      res.json(reporte);
    } catch (error) {
      console.error("Error generando reporte IVA:", error);
      res.status(500).json({ error: "Error al generar reporte de IVA" });
    }
  });

  // ============================================
  // ENDPOINTS DE CONTINGENCIA
  // ============================================

  app.get("/api/contingencia/estado", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const pendientes = await storage.getContingenciaQueue(tenantId, "pendiente");
      const procesando = await storage.getContingenciaQueue(tenantId, "procesando");
      const completadas = await storage.getContingenciaQueue(tenantId, "completado");
      const errores = await storage.getContingenciaQueue(tenantId, "error");

      res.json({
        pendientes: pendientes.length,
        procesando: procesando.length,
        completadas: completadas.length,
        errores: errores.length,
        cola: {
          pendientes,
          procesando,
          completadas,
          errores
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estado de contingencia" });
    }
  });

  app.post("/api/contingencia/procesar", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      console.log(`[API] Procesando cola de contingencia para tenant ${tenantId}...`);
      
      await mhService.procesarColaContingencia(tenantId);
      
      const estado = await storage.getContingenciaQueue(tenantId);
      res.json({
        success: true,
        mensaje: "Cola de contingencia procesada",
        resumen: estado
      });
    } catch (error) {
      console.error("Error procesando contingencia:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Error al procesar contingencia" 
      });
    }
  });

  // ============================================
  // ENDPOINTS DE DATOS DE PRUEBA (Solo Desarrollo)
  // ============================================
  
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/seed/facturas", requireAuth, async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        const { cantidad = 10 } = req.body;
        const facturasPrueba = generarFacturasPrueba(cantidad);
        
        const facturasCreadas = [];
        for (const factura of facturasPrueba) {
          const facturaCompleta = { ...factura, externalId: factura.externalId || undefined };
          const creada = await storage.createFactura(tenantId, facturaCompleta);
          facturasCreadas.push(creada);
        }

        res.json({ success: true, cantidad: facturasCreadas.length });
      } catch (error) {
        res.status(500).json({ error: "Error al generar datos de prueba" });
      }
    });

    app.post("/api/seed/emisor", requireAuth, async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        const emisor = await storage.saveEmisor(tenantId, EMISOR_PRUEBA);
        res.json({ success: true, emisor });
      } catch (error) {
        res.status(500).json({ error: "Error al guardar emisor de prueba" });
      }
    });

    app.delete("/api/seed/facturas", requireAuth, async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        const facturas = await storage.getFacturas(tenantId);
        for (const factura of facturas) {
          if (factura.id) await storage.deleteFactura(factura.id, tenantId);
        }
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Error al limpiar facturas" });
      }
    });
  }

  return httpServer;
}
