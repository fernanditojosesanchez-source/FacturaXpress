# 📗 Guía de Operaciones - FacturaXpress

**Versión**: 2.1.0  
**Fecha**: 18 de enero de 2026  
**Audiencia**: DevOps, SRE, Operadores de Producción

---

## 🎯 Propósito

Esta guía proporciona procedimientos operacionales para administrar, monitorear y troubleshoot FacturaXpress en producción.

---

## 📋 Índice

1. [Operaciones Diarias](#operaciones-diarias)
2. [Monitoreo y Alertas](#monitoreo-y-alertas)
3. [Troubleshooting Común](#troubleshooting-común)
4. [Procedimientos de Emergencia](#procedimientos-de-emergencia)
5. [Mantenimiento Programado](#mantenimiento-programado)
6. [Backups y Recovery](#backups-y-recovery)

---

## 1️⃣ Operaciones Diarias

### Verificación de Salud del Sistema

**Frecuencia**: Diaria (9:00 AM)

```bash
# 1. Verificar que el servidor está respondiendo
curl http://localhost:5000/api/health

# Respuesta esperada:
# {"status":"ok","timestamp":"..."}

# 2. Verificar estado detallado
curl http://localhost:5000/api/health/detailed \
  -H "Authorization: Bearer <admin-token>"

# 3. Verificar logs recientes
tail -f -n 100 server.log | grep -E "error|warning|critical"

# 4. Verificar cron jobs ejecutados en las últimas 24h
cat server.log | grep -E "Scheduler|Auto-rollout|CatalogSync" | tail -20
```

### Revisar Logs de Cron Jobs

**Catalog Sync** (revisa a las 3:00 AM):
```bash
cat server.log | grep "CatalogSync" | grep "$(date +%Y-%m-%d)"

# Salida esperada:
# [CatalogSync] Iniciando sincronización...
# [CatalogSync] Sincronización completada: 6 actualizado(s), 0 error(es)
```

**Feature Flags Auto-Rollout** (revisa cada 15 min):
```bash
cat server.log | grep "Auto-rollout" | tail -10

# Salida esperada cada 15 min:
# ✅ Auto-rollout: 2/5 flags actualizados
```

### Verificar Estado de BD

```sql
-- Conectarse a Supabase

-- 1. Verificar conexiones activas
SELECT count(*) FROM pg_stat_activity 
WHERE datname = 'postgres';

-- 2. Verificar tamaño de tablas principales
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
LIMIT 10;

-- 3. Verificar índices sin usar
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' AND indexname NOT IN (
  SELECT indexrelname FROM pg_stat_user_indexes WHERE idx_scan > 0
);
```

---

## 2️⃣ Monitoreo y Alertas

### Métricas Clave

| Métrica | Threshold | Alerta |
|---------|-----------|--------|
| CPU > 80% | 5 minutos | Warning |
| Memoria > 90% | 3 minutos | Critical |
| Disco > 85% | 10 minutos | Warning |
| HTTP 5xx > 10/min | Inmediato | Critical |
| Latencia p95 > 2s | 5 minutos | Warning |
| Worker Pool Queue > 50 | 2 minutos | Warning |

### Health Checks Automatizados

**Script de monitoreo** (`scripts/health-check.sh`):
```bash
#!/bin/bash

# Health check automatizado
HEALTH_URL="http://localhost:5000/api/health"
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
  
  if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Health check passed"
    exit 0
  fi
  
  echo "⚠️ Retry $i/$MAX_RETRIES (HTTP $HTTP_CODE)"
  sleep $RETRY_DELAY
done

echo "❌ Health check failed after $MAX_RETRIES retries"
exit 1
```

**Configurar cron para monitoreo** (cada 5 minutos):
```bash
crontab -e

# Agregar:
*/5 * * * * /path/to/health-check.sh >> /var/log/health-check.log 2>&1
```

### Alertas de Certificados

**Revisar alertas de certificados próximos a expirar**:
```bash
curl http://localhost:5000/api/admin/certificate-alerts \
  -H "Authorization: Bearer <admin-token>"

# Respuesta incluye:
# - Certificados que expiran en 30 días
# - Certificados que expiran en 7 días
# - Certificados expirados
```

---

## 3️⃣ Troubleshooting Común

### Problema: Servidor no responde

**Síntomas**:
- HTTP 500/503 errors
- Timeout en requests
- Health check falla

**Diagnóstico**:
```bash
# 1. Verificar que el proceso está corriendo
ps aux | grep node

# 2. Verificar puertos
netstat -tulpn | grep :5000

# 3. Revisar últimas líneas de log
tail -n 50 server.log
```

**Resolución**:
```bash
# Opción 1: Reinicio suave (graceful)
kill -SIGTERM <PID>
npm start

# Opción 2: Reinicio forzado
kill -9 <PID>
npm start

# Opción 3: Con systemd (producción)
sudo systemctl restart facturaxpress
```

---

### Problema: Feature Flags no se incrementan

**Síntomas**:
- Logs no muestran "Auto-rollout" cada 15 min
- porcentaje_rollout no aumenta en BD

**Diagnóstico**:
```bash
# 1. Verificar logs de scheduler
cat server.log | grep "Scheduler de auto-rollout"

# 2. Verificar que hay flags con estrategia gradual
psql -h <db-host> -d postgres -c "SELECT id, key, estrategia, porcentaje_rollout, habilitado FROM feature_flags WHERE estrategia = 'gradual';"

# 3. Verificar errores en feature-flags-service
cat server.log | grep -i "feature.*flag.*error"
```

**Resolución**:
```bash
# Si no hay flags con estrategia gradual, crear uno de prueba:
curl -X POST http://localhost:5000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "key": "test_rollout",
    "nombre": "Test Rollout",
    "estrategia": "gradual",
    "habilitado": true,
    "porcentaje_rollout": 0
  }'

# Esperar 15 minutos y verificar incremento
```

---

### Problema: Catalog Sync falla

**Síntomas**:
- Logs muestran errores a las 2:00 AM
- `GET /api/catalogs/versions` devuelve versiones antiguas

**Diagnóstico**:
```bash
# 1. Revisar logs de CatalogSync
cat server.log | grep "CatalogSync" | tail -20

# 2. Verificar conectividad a API DGII
curl -I https://api.dgii.gov.do/

# 3. Verificar última sincronización exitosa
psql -h <db-host> -d postgres -c "SELECT * FROM catalog_sync_history ORDER BY created_at DESC LIMIT 5;"
```

**Resolución**:
```bash
# Forzar sincronización manual
curl -X POST http://localhost:5000/api/admin/catalogs/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>"

# Si persiste el error, revisar credenciales y permisos de BD
```

---

### Problema: Worker Pool Saturado

**Síntomas**:
- Latencia alta en firmas de DTEs
- Logs muestran "Worker pool queue size > 50"
- Métricas de worker pool:
  - `completedTasks` no aumenta
  - `avgTime` > 5000ms

**Diagnóstico**:
```bash
# 1. Verificar métricas de workers
curl http://localhost:5000/api/admin/worker-metrics \
  -H "Authorization: Bearer <admin-token>"

# Respuesta esperada:
# {
#   "totalTasks": 1234,
#   "completedTasks": 1200,
#   "failedTasks": 2,
#   "avgTime": 180,
#   "queueSize": 5
# }

# 2. Revisar logs de workers
cat server.log | grep -i "worker" | tail -30
```

**Resolución**:
```bash
# Opción 1: Aumentar número de workers (editar server/lib/workers.ts)
# Cambiar:
# const pool = new SignerWorkerPool(4); // 4 workers
# A:
# const pool = new SignerWorkerPool(8); // 8 workers

# Opción 2: Reiniciar servidor para limpiar queue
npm restart

# Opción 3: Investigar si hay DTEs anormalmente grandes
psql -h <db-host> -d postgres -c "SELECT id, LENGTH(documento) as size FROM dtes ORDER BY size DESC LIMIT 10;"
```

---

### Problema: Vault Logs modificados

**Síntomas**:
- Alerta de tampering
- Registros en `vault_tampering_attempts`

**Diagnóstico**:
```sql
-- Verificar intentos de modificación
SELECT * FROM vault_tampering_attempts 
ORDER BY created_at DESC 
LIMIT 10;

-- Revisar qué usuario intentó modificar
SELECT vta.*, u.email 
FROM vault_tampering_attempts vta
JOIN users u ON vta.user_id = u.id
ORDER BY vta.created_at DESC;
```

**Resolución**:
1. **Investigar**: Identificar al usuario que intentó modificar logs
2. **Notificar**: Escalar a Security Team
3. **Auditar**: Revisar todos los accesos recientes del usuario:
```sql
SELECT * FROM vault_access_log 
WHERE user_id = '<suspicious-user-id>' 
ORDER BY created_at DESC;
```
4. **Acción**: Revocar acceso si es necesario

---

### Problema: Redis desconectado

**Síntomas**:
- Logs muestran "Redis error"
- Rate limiting usa memoria local
- BullMQ deshabilitado

**Diagnóstico**:
```bash
# 1. Verificar conectividad
redis-cli -h <redis-host> -p <redis-port> --tls ping

# 2. Revisar credenciales en .env
cat .env | grep REDIS

# 3. Verificar allowlist de IP
# (Contactar proveedor de Redis)
```

**Resolución**:
```bash
# Si es problema de conexión temporal, el servidor degrada gracefully
# No se requiere acción inmediata

# Si persiste > 1 hora:
# 1. Revisar allowlist de Redis
# 2. Verificar credenciales
# 3. Contactar soporte de Redis Cloud
```

---

## 4️⃣ Procedimientos de Emergencia

### Kill Switch de Feature Flags

**Escenario**: Feature flag causa error crítico en producción

```bash
# 1. Deshabilitar flag inmediatamente
curl -X PATCH http://localhost:5000/api/admin/feature-flags/<flag-key> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"habilitado": false}'

# 2. Verificar deshabilitación
curl -X GET http://localhost:5000/api/admin/feature-flags/<flag-key> \
  -H "Authorization: Bearer <admin-token>"

# 3. Notificar al equipo de desarrollo
```

### Rollback de Deployment

**Escenario**: Nuevo deployment causa errores

```bash
# 1. Identificar commit anterior estable
git log --oneline -n 10

# 2. Rollback
git revert <bad-commit-hash>
git push origin main

# 3. Re-deployar
npm run build
npm restart

# 4. Verificar que el rollback fue exitoso
curl http://localhost:5000/api/health
```

### Circuit Breaker Abierto (API MH caída)

**Escenario**: Circuit breaker detecta que API MH está caída

```bash
# 1. Verificar estado del circuit breaker
curl http://localhost:5000/api/health/detailed \
  -H "Authorization: Bearer <admin-token>" | jq '.circuitBreaker'

# Respuesta:
# {
#   "state": "OPEN",
#   "failureCount": 5,
#   "nextAttempt": "2026-01-18T12:30:00Z"
# }

# 2. Las facturas se encolan automáticamente en contingencia
# No se requiere acción manual

# 3. Monitorear recuperación:
watch -n 60 'curl -s http://localhost:5000/api/health/detailed -H "Authorization: Bearer <token>" | jq .circuitBreaker.state'

# Cuando cambie a "CLOSED", el servicio se recuperó
```

---

## 5️⃣ Mantenimiento Programado

### Actualización de Certificados

**Frecuencia**: Anual o cuando expira

```bash
# 1. Subir nuevo certificado P12 vía UI o API
curl -X POST http://localhost:5000/api/admin/certificates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "tenant_id": "<tenant-id>",
    "p12_base64": "<nuevo-certificado-base64>",
    "password": "<password>"
  }'

# 2. Verificar que el certificado es válido
curl -X GET http://localhost:5000/api/admin/certificates/<tenant-id> \
  -H "Authorization: Bearer <admin-token>"

# 3. Probar firma con nuevo certificado
# (Usar endpoint de test o crear DTE de prueba)
```

### Actualización de Catálogos DGII

**Frecuencia**: Automática (diaria), manual si hay cambios urgentes

```bash
# Forzar sincronización manual
curl -X POST http://localhost:5000/api/admin/catalogs/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"force": true}'

# Verificar cambios
curl -X GET http://localhost:5000/api/catalogs/versions \
  -H "Authorization: Bearer <token>"
```

### Limpieza de Datos Antiguos

**Frecuencia**: Mensual

```sql
-- Limpiar logs de acceso > 90 días
-- NOTA: vault_access_log es INMUTABLE, usar partitioning o archiving

-- Limpiar DTE drafts > 30 días
DELETE FROM dte_drafts 
WHERE created_at < NOW() - INTERVAL '30 days' 
AND estado = 'draft';

-- Limpiar evaluaciones de feature flags > 60 días
DELETE FROM feature_flag_evaluations 
WHERE created_at < NOW() - INTERVAL '60 days';

-- Vacuum tablas
VACUUM ANALYZE dte_drafts;
VACUUM ANALYZE feature_flag_evaluations;
```

---

## 6️⃣ Backups y Recovery

### Backup de Base de Datos

**Frecuencia**: Diario (automatizado por Supabase)

**Verificación manual**:
```bash
# Verificar backups en Supabase Dashboard
# https://app.supabase.com/project/<project-id>/database/backups

# Crear backup manual adicional
pg_dump -h <db-host> -U postgres -d postgres -F c -f backup_$(date +%Y%m%d).dump
```

### Restore de Base de Datos

**Escenario**: Corrupción de datos o error humano

```bash
# 1. Detener aplicación
npm stop

# 2. Restore desde backup
pg_restore -h <db-host> -U postgres -d postgres -c backup_YYYYMMDD.dump

# 3. Verificar integridad
psql -h <db-host> -U postgres -d postgres -c "SELECT COUNT(*) FROM dtes;"

# 4. Reiniciar aplicación
npm start
```

### Recovery de Certificados

**Escenario**: Pérdida de certificado en Vault

```bash
# Los certificados están encriptados en Supabase Vault
# Recovery requiere acceso al proyecto de Supabase

# 1. Conectarse a Supabase
# 2. Ejecutar query:
SELECT vault.decrypt_secret(certificado_encriptado, 'tenant-id') 
FROM tenant_certificates 
WHERE tenant_id = '<tenant-id>';

# 3. Re-subir certificado si es necesario
```

---

## 📞 Contactos de Emergencia

| Rol | Nombre | Contacto |
|-----|--------|----------|
| Tech Lead | TBD | email@example.com |
| DevOps Lead | TBD | email@example.com |
| Database Admin | TBD | email@example.com |
| Security Team | TBD | security@example.com |
| Supabase Support | - | https://supabase.com/support |

---

## 📝 Logs y Auditoría

### Ubicación de Logs

| Log | Ubicación | Retention |
|-----|-----------|-----------|
| Application | `server.log` | 30 días |
| Access | `access.log` | 90 días |
| Error | `error.log` | 90 días |
| Vault | `vault_access_log` (BD) | Permanente |

### Análisis de Logs

```bash
# Errores más comunes
cat server.log | grep -i error | sort | uniq -c | sort -rn | head -10

# Endpoints más lentos
cat server.log | grep "latency" | awk '{print $NF}' | sort -rn | head -10

# Usuarios más activos
cat access.log | awk '{print $4}' | sort | uniq -c | sort -rn | head -10
```

---

**Última actualización**: 18 de enero de 2026  
**Próxima revisión**: 18 de febrero de 2026

Para procedimientos más detallados, consultar:
- [DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md)
- [DEPLOYMENT_VALIDATION.md](DEPLOYMENT_VALIDATION.md)
- [TROUBLESHOOTING_RUNBOOK.md](TROUBLESHOOTING_RUNBOOK.md) (próximamente)
