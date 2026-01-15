// Restart: 2026-01-11 12:15
import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { apiGeneralRateLimiter, loginRateLimiter } from "./lib/rate-limiters";
import certificadosRouter from "./routes/certificados";

// Manejadores globales de errores
process.on("uncaughtException", (error) => {
  console.error("❌ UNCAUGHT EXCEPTION:", error);
  // No matamos el proceso, solo lo registramos
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
  // No matamos el proceso, solo lo registramos
});

const app = express();
const httpServer = createServer(app);

// Seguridad: Confiar en el primer proxy (necesario para Rate Limiting detrás de Nginx/LoadBalancers)
// Esto asegura que req.ip y x-forwarded-for sean procesados correctamente y no spoofed fácilmente.
app.set("trust proxy", 1);

// CORS mejorado: Solo permitir orígenes específicos en producción
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

// Helmet: Headers de seguridad HTTP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"], // Vite dev needs unsafe-eval, blob: for service workers
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // ✅ Permitir Google Fonts CSS
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"], // ✅ Permitir archivos de fuentes (.woff2)
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        workerSrc: ["'self'", "blob:"], // ✅ Permitir Service Workers desde blob URLs
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

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Rate limiting mejorado: por tenant + IP
app.use("/api/auth/login", loginRateLimiter);
app.use("/api", apiGeneralRateLimiter);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Reducir ruido: no loguear /api/auth/me para evitar spam en terminal
      if (path === "/api/auth/me") {
        return;
      }
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Inicializar base de datos (PostgreSQL/Supabase)
    log("Inicializando storage...");
    await storage.initialize();
    log("✅ Storage inicializado");

    // Crear usuario por defecto si no existe
    const existingUser = await storage.getUserByUsername("admin");
    if (!existingUser) {
      log("Creando usuario admin...");
      const adminPassword = process.env.ADMIN_PASSWORD || "admin";
      
      if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
        log("⚠️ ADVERTENCIA: Creando usuario admin con contraseña por defecto en producción. Configure ADMIN_PASSWORD.");
      }

      const bcrypt = await import("bcrypt");
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      // Crear tenant por defecto primero si no existe
      const defaultTenant = await storage.ensureDefaultTenant();
      
      await storage.createUser({ 
        username: "admin", 
        password: hashedPassword,
        role: "super_admin",
        tenantId: defaultTenant.id 
      });
      log(`✅ Usuario admin creado (Password: ${process.env.ADMIN_PASSWORD ? "********" : "admin"})`);
    }

    log("Registrando rutas...");
    await registerRoutes(httpServer, app);
    app.use("/api", certificadosRouter); // <-- AÑADIR ESTA LÍNEA
    log("✅ Rutas registradas");

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`❌ Error: ${message}`, "error");
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      log("Modo producción: sirviendo archivos estáticos");
      serveStatic(app);
    } else {
      log("Configurando Vite...");
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
      log("✅ Vite configurado");
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5000", 10);
    log(`Iniciando servidor en puerto ${port}...`);
    httpServer.listen(
      port,
      () => {
        log(`serving on port ${port}`);
        log(`✅ Servidor listo en http://localhost:${port}`);
      },
    );
  } catch (error) {
    log(`❌ Error durante inicialización: ${error}`, "error");
    console.error(error);
    throw error;
  }
})().catch((err) => {
  log(`❌ Fatal error during startup: ${err.message}`, "error");
  console.error(err);
  process.exit(1);
});
