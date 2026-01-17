# Estado del Proyecto FacturaXpress

## Resumen Ejecutivo

**Fase**: Post-auditoría técnica, implementación de mejoras P0/P1 + Outbox
**Progreso General**: 4 de 16 TODOs completados (25%)
**Última Actualización**: 2026-01-16

### Estado por Prioridad

| Prioridad | P0 | P1 | P2 | P3 |
|-----------|-----|-----|-----|-----|
| **Completados** | 2/2 ✅ | 0/4 | 1/8 | 0/2 |
| **En Progreso** | - | 1/4 | - | - |
| **Pendientes** | - | 3 | 7 | 2 |

---

## P0: Críticos (Completados ✅)

### ✅ 1. Provisión Redis
- **Estado**: COMPLETADO
- **Archivos**: 
  - [server/lib/redis.ts](server/lib/redis.ts) - Cliente singleton (librería oficial `redis` v4.7.0)
  - [.env](.env) - Credenciales Redis Cloud con TLS
- **Bloqueador**: Conectividad por allowlist/firewall (documentado)
- **Fallback**: Rate limiting usa memoria automáticamente
- **Commit**: `6f05b89`, `6a5d856`

### ✅ 2. Circuit Breaker API MH
- **Estado**: COMPLETADO
- **Archivos**:
  - [server/lib/circuit-breaker.ts](server/lib/circuit-breaker.ts) - Patrón CB: CLOSED/OPEN/HALF_OPEN
  - [server/mh-service.ts](server/mh-service.ts) - Clase `MHServiceWithBreaker` con fallback a contingencia
  - [CIRCUIT_BREAKER.md](CIRCUIT_BREAKER.md) - Documentación del patrón
  - [server/routes.ts](server/routes.ts) - Health check endpoints
- **Características**:
  - 5 fallos → OPEN, 2 éxitos → CLOSED
  - Backoff exponencial: 5s → 10s → 20s → 40s (máx 8x)
  - Fallback a cola de contingencia automático
  - Health check: `GET /api/health`, `GET /api/health/detailed`
- **Beneficios**: 
  - Previene cascadas de fallos
  - Sin bloqueos cuando MH está caído
  - Facturas se encolan automáticamente
- **Commit**: `33a6022`

### 🔄 3. Migración Rate Limiting a Redis (COMPLETADO pero pendiente validación)
- **Estado**: COMPLETADO (código listo, conectividad bloqueada)
- **Archivos**:
  - [server/lib/rate-limiters.ts](server/lib/rate-limiters.ts) - Store distribuido + fallback
  - [package.json](package.json) - `rate-limit-redis` v4.0.0
- **Próximo**: Validar conectividad cuando se resuelva allowlist Redis

---

## P1: Altos (0/4 completados)

### ⏳ 4. BullMQ y Colas Críticas
- **Prioridad**: Alta (infraestructura de jobs)
- **Requisitos**: 
  - Colas: firma, transmisión, contingencia, notificaciones
  - Idempotencia por DTE ID
  - Backoff exponencial, TTL
  - Payloads estructurados
- **Dependencia**: Redis conectado (bloqueador actual)
- **Próximo**: Diseño de payloads y workers

### ⏳ 5. Alertas Expiración Certificados
- **Prioridad**: Alta (compliance/UX)
- **Requisitos**:
  - Servicio programado (node-cron)
  - Alertas: 90/60/30/15/7 días
  - Canales: Email, SMS, Webhooks
  - Escalamiento y acuse de recibo
- **Próximo**: Implementar servicio de alertas

### ⏳ 6. Sync de Esquemas DGII/MH
- **Prioridad**: Alta (compatibility)
- **Requisitos**:
  - Descarga automática de nuevas versiones
  - Versionado local
  - Flags de activación y rollback
- **Próximo**: Diseño de servicio de sincronización

### ⏳ 7. Streaming de Logs a SIEM
- **Prioridad**: Alta (compliance/auditoría)
- **Requisitos**:
  - Exportación segura (Datadog/ELK/S3)
  - Retención inmutable
  - Integridad y alertas
- **Próximo**: Integración con SIEM

---

## P2: Medios (1/8 completados)

### ⏳ 8. Workers Dedicados + DLQ + Métricas
- **Dependencia**: BullMQ (paso 4)
- **Requisitos**: Procesos worker, Dead Letter Queues, Prometheus, Bull Board

### ✅ 9. Outbox Transaccional
- **Estado**: COMPLETADO (end-to-end)
- **Implementado**:
  - Encolado transaccional al crear factura (ACID)
  - Procesador en background por lotes con idempotencia
  - Retries con backoff exponencial y disponibilidad diferida
  - Métricas Prometheus expuestas en `/metrics` (gauges outbox)
  - Endpoints admin: `GET /api/admin/outbox/stats`, `POST /api/admin/outbox/replay`
  - Integrado en ciclo de vida del servidor (start/stop ordenado)
- **Pendiente**:
  - Configurar ENV de SMTP/Twilio para notificaciones (prod/dev)
  - Redis para BullMQ (no bloquea Outbox; se usa fallback)
  - Resolver TS pendientes: `server/dgii-validator.ts` (Ajv/resolveJsonModule) y `shared/schema.ts` (boolean → never)
  - Ajustar seeds/insert inicial de canales (opcional) si no se cargan por app
  - **BD**: Tablas `outbox_events`, `notification_channels`, `notification_logs` ya aplicadas en Supabase (SQL manual)

### ⏳ 10. Modo Rendimiento Adaptativo
- **Requisitos**: Detección hardware, toggle persistente, desactivar animaciones

### ⏳ 11. Borradores Offline + Sync
- **Requisitos**: IndexedDB, Service Worker, resolución de conflictos

### ⏳ 12. Vista Soporte Sigma + Auditoría
- **Requisitos**: Métricas, logs sin PII, RBAC, acceso temporal

### ⏳ 13. Stock en Tránsito
- **Requisitos**: Modelo de datos, estados, APIs, auditoría

### ⏳ 14. Plan Migración a Monorepo
- **Requisitos**: Estructura de paquetes, build, testing, CI

### ⏳ 15. Pruebas Carga y Resiliencia
- **Requisitos**: k6/Locust, SLOs, chaos testing

---

## P3: Bajos (0/2 completados)

### ⏳ 16. Despliegue Gradual + Flags
- **Requisitos**: Rollout por porcentaje, feature flags, canary, monitoreo

---

## Bloqueadores Actuales

### 🔴 Redis Conectividad (ACTIVO)
- **Causa**: Allowlist/firewall en Redis Cloud sin IP local
- **Impacto**: 
  - Rate limiting distribuido no funciona (fallback a memoria ✅)
  - BullMQ no puede iniciar (bloqueador para paso 4)
- **Solución**: Agregar IP local a allowlist Redis Cloud
- **Estado Documentación**: [REDIS_STATUS.md](REDIS_STATUS.md)
- **Alternativas**:
  - Docker Redis local
  - Render Redis (free tier)
  - Upstash (serverless)

### ⚠️ Dependencias Encadenadas
- Paso 3 (Redis conectado) → Paso 4 (BullMQ) → Paso 5 (Workers)

---

## Cambios Recientes

### Commit `33a6022` (Circuit Breaker)
```
feat(circuit-breaker): implementar patrón Circuit Breaker para API MH
- Clase CircuitBreaker: estados CLOSED/OPEN/HALF_OPEN
- MHServiceWithBreaker: fallback a contingencia automático
- Health check endpoints: /api/health, /api/health/detailed
- CIRCUIT_BREAKER.md: documentación completa
```

### Commit `6a5d856` (Redis Oficial)
```
chore(redis): migrar de ioredis a librería oficial redis
- Librería oficial v4.7.0 con mejor soporte TLS
- Socket TLS explícito
- Error handling mejorado
```

### Commit `6f05b89` (Rate Limit Redis)
```
feat(rate-limit): habilitar store Redis distribuido con fallback a memoria
- rate-limit-redis v4.0.0 integrado
- Store distribuido con fallback automático
```

---

## Roadmap Próximos Pasos

### Corto Plazo (1-2 semanas)
1. **Resolver conectividad Redis** (agregar IP a allowlist)
2. **Iniciar BullMQ** (paso 4 - diseño de colas)
3. **Alertas certificados** (paso 5 - P1 alto)

### Mediano Plazo (2-4 semanas)
4. **Workers dedicados** (paso 5)
5. **Outbox transaccional** (paso 6)
6. **Sync de esquemas** (paso 7)

### Largo Plazo (4-8+ semanas)
7. **P2 items** (UX, offline, Sigma, stock, monorepo)
8. **Pruebas carga** y despliegue gradual

---

## Métricas de Calidad

### ✅ Completados
- Circuit Breaker implementado y documentado
- Rate limiting preparado (fallback funcional)
- Health checks expuestos

### ⚠️ En Riesgo
- Redis conectividad bloqueada
- BullMQ aguardando Redis

### 📊 Próximas Mediciones
- Latencia de health check: <100ms
- Tasa de éxito rate limiter con fallback: 100%
- Transiciones de Circuit Breaker: logging automático

---

## Referencias

- [CIRCUIT_BREAKER.md](CIRCUIT_BREAKER.md) - Documentación patrón CB
- [REDIS_STATUS.md](REDIS_STATUS.md) - Estado conectividad Redis
- [PLAN_ACCION.md](PLAN_ACCION.md) - Plan estratégico completo
- [ANÁLISIS_SINCRONIZACIÓN.md](ANALISIS_SINCRONIZACION.md) - Auditoría original

---

## Notas para el Equipo

- **Circuit Breaker no depende de Redis**: El patrón CB funciona independientemente
- **Fallback multiplicado**: Rate limiting + Circuit Breaker = defensa multinivel
- **Próximo cuello de botella**: BullMQ requiere Redis conectado
- **Alternativa escalable**: Si Redis Cloud no se puede resolver, considerar Docker local o Upstash

---

**Actualizado por**: AI Assistant
**Próxima revisión**: Cuando se resuelva connectividad Redis o cuando se complete el siguiente TODO
