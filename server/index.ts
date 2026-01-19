// Restart: 2026-01-11 12:15
import "dotenv/config";
import { logger } from "./lib/logger.js";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import { storage } from "./storage.js";
import { apiGeneralRateLimiter, loginRateLimiter } from "./lib/rate-limiters.js";
import certificadosRouter from "./routes/certificados.js";
import { initQueues } from "./lib/queues.js";
import { startCertificateAlertsScheduler } from "./lib/alerts.js";
import { initWorkers, closeWorkers } from "./lib/workers.js";
import { startOutboxProcessor, stopOutboxProcessor } from "./lib/outbox-processor.js";
import { startSchemaSync, stopSchemaSync } from "./lib/schema-sync.js";
import { startDLQCleanup } from "./lib/dlq.js";
import { setupBullBoard } from "./routes/bull-board.js";
import { startCatalogSyncScheduler, stopCatalogSyncScheduler } from "./lib/catalog-sync-scheduler.js";

// Manejadores globales de errores
process.on("uncaughtException", (error) => {
  logger.error("❌ UNCAUGHT EXCEPTION:", error);
});

process.on("unhandledRejection", (reason) => {
  logger.error("❌ UNHANDLED REJECTION:", reason);
});

const app = express();
const httpServer = createServer(app);

// Mantener referencia a schedulers para detenerlos en shutdown
let alertsTimer: NodeJS.Timeout | null = null;
let schemaSyncTimer: NodeJS.Timeout | null = null;
let dlqCleanupTimer: NodeJS.Timeout | null = null;
let catalogSyncTimer: NodeJS.Timeout | null = null;
let featureFlagsRolloutTimer: NodeJS.Timeout | null = null;

app.set("trust proxy", 1);

// CORS mejorado
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5000", "http://localhost:3015"];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (process.env.NODE_ENV !== "production" || allowedOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use("/api/auth/login", loginRateLimiter);
app.use("/api", apiGeneralRateLimiter);

export function log(message: string, source = "express") {
  logger.info(`[${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      if (path === "/api/auth/me") return;
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  try {
    log("Inicializando storage...");
    await storage.initialize();
    log("✅ Storage inicializado");

    const existingUser = await storage.getUserByUsername("admin");
    if (!existingUser) {
      log("Creando usuario admin...");
      const adminPassword = process.env.ADMIN_PASSWORD || "admin";

      const bcrypt = await import("bcrypt");
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const defaultTenant = await storage.ensureDefaultTenant();

      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        role: "super_admin",
        tenantId: defaultTenant.id
      });
      log(`✅ Usuario admin creado`);
    }

    log("Registrando rutas...");
    await registerRoutes(httpServer, app);
    app.use("/api", certificadosRouter);
    log("✅ Rutas registradas");

    initQueues()
      .then(async (q) => {
        if (!q.enabled) return;
        log("✅ BullMQ colas inicializadas");
        const workers = await initWorkers();
        if (workers.started > 0) log(`✅ ${workers.started} workers iniciados`);
        setupBullBoard(app);
        await startOutboxProcessor(5000);
      })
      .catch((err) => {
        log(`⚠️ Error inicializando BullMQ: ${(err as Error).message}`);
      });

    alertsTimer = startCertificateAlertsScheduler();
    schemaSyncTimer = startSchemaSync();
    catalogSyncTimer = startCatalogSyncScheduler();

    featureFlagsRolloutTimer = setInterval(async () => {
      try {
        const { featureFlagsService } = await import("./lib/feature-flags-service.js");
        const result = await featureFlagsService.processAutomaticRollouts();
        if (result.updated > 0) {
          log(`✅ Auto-rollout: ${result.updated}/${result.processed} flags actualizados`);
        }
      } catch (error) {
        log(`❌ Error en auto-rollout de feature flags: ${(error as Error).message}`);
      }
    }, 15 * 60 * 1000);

    dlqCleanupTimer = startDLQCleanup();

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`❌ Error: ${message}`, "error");
      res.status(status).json({ message });
    });

    if (process.env.NODE_ENV === "production") {
      log("Modo producción: sirviendo archivos estáticos");
      serveStatic(app);
    } else {
      log("Configurando Vite...");
      const { setupVite } = await import("./vite.js");
      await setupVite(httpServer, app);
      log("✅ Vite configurado");
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(port, () => {
      log(`✅ Servidor listo en puerto ${port}`);
    });

    const shutdown = async () => {
      log("🛑 Iniciando graceful shutdown...");
      if (alertsTimer) clearInterval(alertsTimer);
      if (dlqCleanupTimer) clearInterval(dlqCleanupTimer);
      if (featureFlagsRolloutTimer) clearInterval(featureFlagsRolloutTimer);
      if (catalogSyncTimer) stopCatalogSyncScheduler(catalogSyncTimer);
      stopSchemaSync(schemaSyncTimer);
      try { await stopOutboxProcessor(); } catch (err) { }
      try { await closeWorkers(); } catch (err) { }
      httpServer.close(() => {
        log("✅ Servidor HTTP cerrado");
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 30000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    logger.error(`❌ Error durante inicialización: ${(error as Error).message}`, error);
    process.exit(1);
  }
})();
