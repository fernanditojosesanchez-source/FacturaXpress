import { getRedis, redisHealth } from "../server/lib/redis";

(async () => {
  try {
    const health = await redisHealth();
    if (!health.ok) {
      console.error("❌ Redis no responde:", health.message);
      process.exit(1);
    }
    const redis = getRedis();
    if (redis.status !== "ready") await redis.connect();
    const key = `selftest:${Date.now()}`;
    await redis.set(key, "ok", "EX", 10);
    const val = await redis.get(key);
    console.log("✅ PING/PONG y SET/GET OK:", val);
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error de conexión Redis:", err?.message || err);
    process.exit(1);
  }
})();
