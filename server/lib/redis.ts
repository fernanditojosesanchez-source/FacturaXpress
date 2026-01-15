import { createClient, type RedisClient as RedisClientType } from "redis";

type RedisClient = RedisClientType;
let client: RedisClient | null = null;

function getEnvBool(name: string, def = false): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function buildRedisUrl(): { url?: string; config?: any } | null {
  const url = process.env.REDIS_URL;

  if (url) {
    // URL completa (rediss:// automáticamente usa TLS)
    return {
      url,
    };
  }

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  const tls = getEnvBool("REDIS_TLS", false);

  if (!host || !port) {
    return null;
  }

  // Usar configuración con socket explícito
  const config = {
    username,
    password,
    socket: {
      host,
      port,
      tls: tls,
    },
  };

  return { config };
}

export async function getRedis(): Promise<RedisClient> {
  if (client && client.isOpen) return client;

  const cfg = buildRedisUrl();
  if (!cfg) {
    throw new Error("Configuración Redis incompleta: define REDIS_URL o REDIS_HOST/REDIS_PORT");
  }

  // Crear cliente con URL o config
  client = cfg.url ? createClient({ url: cfg.url }) : createClient(cfg.config);

  client.on("error", (err: any) => {
    console.error("❌ Redis error:", err.message);
  });

  client.on("connect", () => {
    if (process.env.NODE_ENV !== "test") {
      console.log("✅ Redis conectado");
    }
  });

  // Conectar si no está ya conectado
  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export async function redisPing(): Promise<string> {
  const r = await getRedis();
  const pong = await r.ping();
  return pong;
}

export async function redisHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const pong = await redisPing();
    return { ok: pong === "PONG", message: pong };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.error("Redis health error:", msg);
    return { ok: false, message: msg };
  }
}

export async function redisDisconnect(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
    client = null;
  }
}
