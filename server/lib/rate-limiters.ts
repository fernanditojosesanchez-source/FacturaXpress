import type { Request } from "express";
import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import type { Store as RateLimitStore } from "express-rate-limit";
import { getRedis } from "./redis";
// rate-limit-redis no trae tipos oficiales; forzamos any al crear el store
let RedisStoreCtor: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RedisStoreCtor = require("rate-limit-redis").RedisStore || require("rate-limit-redis");
} catch {
  RedisStoreCtor = null;
}

function buildRedisStore(): RateLimitStore | undefined {
  if (!RedisStoreCtor) return undefined;
  try {
    const redis = getRedis();
    const prefix = (process.env.REDIS_NAMESPACE || "fx") + ":ratelimit:";
    const store = new RedisStoreCtor({
      // ioredis: usar call para comandos genéricos
      sendCommand: (...args: string[]) => (redis as any).call(...args),
      prefix,
    });
    return store as RateLimitStore;
  } catch {
    return undefined;
  }
}

/**
 * Rate limiter mejorado que usa tenantId en lugar de solo IP
 * Esto previene que un tenant abuse del API incluso desde múltiples IPs
 */
export function createTenantRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
}): RateLimitRequestHandler {
  const store = buildRedisStore();
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: { message: options.message },
    standardHeaders: true,
    legacyHeaders: false,
    // Si Redis está disponible, usamos store distribuido; si no, fallback a memoria
    store: store as any,
    keyGenerator: (req: Request) => {
      // Priorizar tenantId si está autenticado
      const tenantId = (req as any).user?.tenantId;
      if (tenantId) {
        return `tenant:${tenantId}`;
      }
      
      // Fallback a IP si no está autenticado (ej: login)
      const forwarded = req.headers["x-forwarded-for"];
      if (typeof forwarded === "string") {
        return `ip:${forwarded.split(",")[0].trim()}`;
      }
      return `ip:${req.socket.remoteAddress || "unknown"}`;
    },
    skip: (req: Request) => {
      // Permitir bypass para super_admin en casos de emergencia
      const user = (req as any).user;
      return user?.role === "super_admin" && process.env.NODE_ENV === "development";
    },
  });
}

/**
 * Limitadores específicos por función
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: { message: "Demasiados intentos de login. Intenta de nuevo en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    return req.socket.remoteAddress || "unknown";
  },
});

export const transmisionRateLimiter = createTenantRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 transmisiones por minuto por tenant
  message: "Límite de transmisiones alcanzado. Espera 1 minuto.",
});

export const facturaCreationRateLimiter = createTenantRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 50, // 50 facturas por minuto por tenant
  message: "Límite de creación de facturas alcanzado. Espera 1 minuto.",
});

export const apiGeneralRateLimiter = createTenantRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // 300 requests por 15 min por tenant
  message: "Demasiadas peticiones. Intenta de nuevo más tarde.",
});
