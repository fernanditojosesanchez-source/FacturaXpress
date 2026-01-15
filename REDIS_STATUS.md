# Redis Integration - Estado y Roadmap

## Status Actual (15 Ene 2026)

### ✅ Completado
- Cliente Redis: `server/lib/redis.ts` usando librería oficial `redis` v4.7.0
- Rate limiting con store distribuido: `server/lib/rate-limiters.ts` integrado con Redis
- Variables de entorno documentadas: `.env.example` actualizado
- Script de validación: `script/test-redis.ts` listo
- Dependencias instaladas: `redis`, `rate-limit-redis`, `bullmq`

### 🔴 Bloqueado
**Conectividad a Redis Cloud (allowlist/firewall)**
- Error TLS: "packet length too long" (OpenSSL)
- Causa probable: allowlist activo en Redis Cloud sin IP local agregada
- Credenciales verificadas: usuario/password correctos
- Solución: Agregar IP local a "Data Access Control" en Redis Cloud console

### 📋 Configuración Actual (.env)
```bash
REDIS_HOST=redis-12803.c284.us-east1-2.gce.cloud.redislabs.com
REDIS_PORT=12803
REDIS_USERNAME=default
REDIS_PASSWORD=K97s0op3po8Eu9yVeNFju1Su0xNavxcb
REDIS_TLS=true
REDIS_NAMESPACE=fx
```

## Próximos Pasos (cuando resuelvas conectividad)

### 1. Validar conectividad
```bash
npm run check:redis
# Esperado: ✅ PING/PONG y SET/GET OK: ok
```

### 2. Verificar rate limiting distribuido
- Simular 2+ instancias de Express
- Verificar que límites se comparten (no se multiplican)
- Validar cabeceras estándar: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

### 3. Preparar para colas (BullMQ)
- El cliente Redis está listo para BullMQ
- Namespace `fx` aísla claves de rate limiting + colas futuras
- Próximo: Paso 3 (colas de firma, transmisión, contingencia)

## Diagnóstico Rápido

Si la conectividad sigue fallando:

1. **Verificar allowlist en Redis Cloud**
   - Consola → "Data Access Control"
   - Agregar tu IP pública (no la de desarrollo local; usa `curl ifconfig.me`)

2. **Alternativa: Redis local (Docker)**
   ```bash
   docker run -d -p 6379:6379 redis:7
   # Luego ajusta .env:
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_TLS=false
   REDIS_USERNAME=  # omitir si Redis local
   REDIS_PASSWORD=  # omitir si Redis local
   ```

3. **Fallback: modo memoria (sin Redis)**
   - Si `REDIS_*` no está definido, `rate-limiters.ts` mantiene fallback a memoria
   - No es distribuido, pero funciona para instancia única
   - Válido para desarrollo/piloto

## Archivos Modificados
- `package.json`: +redis, +bullmq, +rate-limit-redis
- `server/lib/redis.ts`: Cliente Redis con createClient (librería oficial)
- `server/lib/rate-limiters.ts`: Integración con store Redis (fallback a memoria)
- `.env`: Credenciales Redis Cloud
- `script/test-redis.ts`: Validador de conectividad con `dotenv.config()`

## Notas Técnicas
- **TLS**: Habilitado por defecto en Redis Cloud (puerto 12803)
- **Socket TLS**: Configurado con `socket: { host, port, tls: true }`
- **Namespace**: `fx:` prefija todas las claves para aislar entornos
- **Fallback**: Sin Redis, rate limiting sigue usando memoria (MemoryStore)
