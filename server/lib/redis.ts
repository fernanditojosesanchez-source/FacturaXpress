import Redis, { type RedisOptions } from "ioredis";

type RedisClient = InstanceType<typeof Redis>;
let client: RedisClient | null = null;

function getEnvBool(name: string, def = false): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function buildRedisOptions(): { url?: string; options?: RedisOptions } {
  const url = process.env.REDIS_URL;
  const namespace = process.env.REDIS_NAMESPACE || "fx";
  if (url) {
    return { url: `${url}` /* namespace se aplicará en prefijos de clave */ };
  }
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  const tls = getEnvBool("REDIS_TLS", false);

  if (!host || !port) {
    throw new Error("Configuración Redis incompleta: define REDIS_URL o REDIS_HOST/REDIS_PORT");
  }

  const options: RedisOptions = {
    host,
    port,
    username,
    password,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    tls: tls ? {} : undefined,
    keyPrefix: namespace ? `${namespace}:` : undefined,
  };
  return { options };
}

export function getRedis(): RedisClient {
  if (client) return client;
  const cfg = buildRedisOptions();
  client = cfg.url ? new Redis(cfg.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    keyPrefix: (process.env.REDIS_NAMESPACE || "fx") + ":",
  }) : new Redis(cfg.options!);

  client.on("error", (err: any) => {
    console.error("Redis error:", err.message);
  });
  client.on("connect", () => {
    if (process.env.NODE_ENV !== "test") {
      console.log("✅ Redis conectado");
    }
  });
  return client;
}

export async function redisPing(): Promise<string> {
  const r = getRedis();
  if (!r.status || r.status === "end") await r.connect();
  return r.ping();
}

export async function redisHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const pong = await redisPing();
    return { ok: pong === "PONG", message: pong };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
