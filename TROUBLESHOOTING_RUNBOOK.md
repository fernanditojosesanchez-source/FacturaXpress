# 🔧 Troubleshooting Runbook - FacturaXpress

**Versión**: 2.1.0  
**Fecha**: 18 de enero de 2026  
**Propósito**: Guía rápida de resolución de problemas

---

## 🚨 Incidentes Críticos

### P0: Servidor Completamente Caído

**Síntomas**:
- ❌ Health check devuelve 502/504
- ❌ Ningún endpoint responde
- ❌ `ps aux | grep node` no muestra proceso

**Diagnóstico** (2 minutos):
```bash
# 1. Verificar proceso
ps aux | grep node

# 2. Verificar puerto
netstat -tulpn | grep :5000

# 3. Últimas 50 líneas de log
tail -n 50 server.log
```

**Resolución Inmediata** (5 minutos):
```bash
# Paso 1: Reiniciar servidor
cd /path/to/FacturaXpress
npm start

# Paso 2: Verificar inicialización
tail -f server.log | grep "Servidor listo"

# Paso 3: Health check
curl http://localhost:5000/api/health

# Paso 4: Notificar al equipo
# [Enviar alerta a Slack/Email]
```

**Post-Mortem**:
- Revisar `server.log` para identificar causa raíz
- Documentar en incident log
- Implementar prevención si es recurrente

---

### P0: Base de Datos Inaccesible

**Síntomas**:
- ❌ Logs muestran "connection refused" o "timeout"
- ❌ Todos los endpoints devuelven 500
- ✅ Servidor está corriendo

**Diagnóstico** (3 minutos):
```bash
# 1. Verificar conectividad desde servidor
psql -h <db-host> -U postgres -d postgres -c "SELECT 1;"

# 2. Revisar logs de BD en Supabase Dashboard
# https://app.supabase.com/project/<project-id>/logs

# 3. Verificar credenciales
cat .env | grep DATABASE_URL
```

**Resolución** (10 minutos):
```bash
# Opción 1: Reiniciar conexión de BD
# (Reiniciar servidor para forzar nueva conexión)
npm restart

# Opción 2: Verificar y actualizar DATABASE_URL
# Si cambió la contraseña o host

# Opción 3: Escalar a Supabase Support
# Si el problema es del lado de Supabase
```

**Escalación**:
- Si no se resuelve en 10 min → Escalar a Supabase Support
- Si es downtime planificado → Activar página de mantenimiento

---

### P1: Circuit Breaker Abierto (API MH)

**Síntomas**:
- ⚠️ Facturas se encolan en contingencia
- ⚠️ Logs muestran "Circuit breaker OPEN"
- ✅ Aplicación sigue funcionando

**Diagnóstico** (2 minutos):
```bash
# Verificar estado del circuit breaker
curl http://localhost:5000/api/health/detailed \
  -H "Authorization: Bearer <admin-token>" | jq '.circuitBreaker'

# Respuesta:
# {
#   "state": "OPEN",
#   "failureCount": 5,
#   "nextAttempt": "..."
# }
```

**Resolución** (15 minutos):
```bash
# 1. Verificar si API MH está caída
curl -I https://api.hacienda.gob.do/

# 2. Si API MH está OK, revisar credenciales
cat .env | grep MH_API_KEY

# 3. Esperar a que circuit breaker intente reconectar
# El circuit breaker intentará cada 5s → 10s → 20s → 40s

# 4. Monitorear recuperación
watch -n 30 'curl -s http://localhost:5000/api/health/detailed -H "Authorization: Bearer <token>" | jq .circuitBreaker.state'

# Cuando state = "CLOSED", el servicio se recuperó
```

**Acción Manual**:
```bash
# Si circuit breaker no se cierra automáticamente,
# reiniciar servidor para reset:
npm restart
```

---

## ⚠️ Incidentes de Alta Prioridad

### P1: Worker Pool Saturado

**Síntomas**:
- ⚠️ Latencia > 5 segundos en firmas
- ⚠️ Queue size > 50
- ⚠️ Logs muestran timeouts

**Diagnóstico** (3 minutos):
```bash
# Verificar métricas de workers
curl http://localhost:5000/api/admin/worker-metrics \
  -H "Authorization: Bearer <admin-token>"

# Respuesta problema:
# {
#   "queueSize": 85,
#   "avgTime": 6500,
#   "failedTasks": 15
# }
```

**Resolución** (10 minutos):

**Opción 1: Aumentar workers** (requiere deploy):
```typescript
// Editar server/lib/workers.ts
const pool = new SignerWorkerPool(8); // Cambiar de 4 a 8
```

**Opción 2: Reiniciar para limpiar queue**:
```bash
npm restart
```

**Opción 3: Identificar DTEs problemáticos**:
```sql
-- Buscar DTEs anormalmente grandes
SELECT id, LENGTH(documento::text) as size, tipo
FROM dtes 
WHERE LENGTH(documento::text) > 100000
ORDER BY size DESC 
LIMIT 10;

-- Si hay DTEs de 1MB+, investigar por qué
```

---

### P1: Feature Flag Causa Errores

**Síntomas**:
- ⚠️ Aumento repentino de errores 500
- ⚠️ Errores correlacionados con feature flag específico

**Diagnóstico** (2 minutos):
```bash
# 1. Identificar feature flag activo recientemente
curl http://localhost:5000/api/admin/feature-flags \
  -H "Authorization: Bearer <admin-token>" | jq '.[] | select(.habilitado == true)'

# 2. Revisar logs para identificar errors relacionados
cat server.log | grep -i error | tail -20
```

**Resolución Inmediata** (1 minuto):
```bash
# KILL SWITCH: Deshabilitar feature flag
curl -X PATCH http://localhost:5000/api/admin/feature-flags/<flag-key> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"habilitado": false}'

# Verificar que errores cesaron
tail -f server.log | grep -i error
```

**Post-Incident**:
- Revisar código relacionado con el feature flag
- Ejecutar tests
- Re-habilitar con rollout gradual (10% increments)

---

### P1: Catalog Sync Falla Repetidamente

**Síntomas**:
- ⚠️ Logs muestran errores a las 2:00 AM daily
- ⚠️ Catálogos desactualizados

**Diagnóstico** (5 minutos):
```bash
# 1. Revisar errores específicos
cat server.log | grep "CatalogSync" | grep "error" | tail -10

# 2. Verificar conectividad a API DGII
curl -I https://api.dgii.gov.do/catalogos

# 3. Verificar última sincronización exitosa
psql -h <db-host> -d postgres -c "
  SELECT * FROM catalog_sync_history 
  WHERE status = 'success' 
  ORDER BY created_at DESC 
  LIMIT 1;
"
```

**Resolución** (10 minutos):

**Opción 1: Forzar sincronización manual**:
```bash
curl -X POST http://localhost:5000/api/admin/catalogs/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"force": true}'
```

**Opción 2: Si API DGII está caída**:
```bash
# Esperar a que API se recupere
# El scheduler reintentará automáticamente a las 2:00 AM del próximo día
```

**Opción 3: Si es error de credenciales/permisos**:
```bash
# Verificar permisos de BD
psql -h <db-host> -d postgres -c "
  SELECT grantee, privilege_type 
  FROM information_schema.table_privileges 
  WHERE table_name = 'catalog_versions';
"
```

---

## 📊 Problemas de Performance

### Latencia Alta en Endpoints

**Síntomas**:
- ⚠️ p95 latency > 2 segundos
- ⚠️ Usuarios reportan lentitud

**Diagnóstico** (5 minutos):
```bash
# 1. Identificar endpoints más lentos
cat server.log | grep "latency" | awk '{print $2, $NF}' | sort -k2 -rn | head -10

# 2. Verificar carga de CPU/Memoria
top -bn1 | grep "node"

# 3. Verificar conexiones de BD
psql -h <db-host> -d postgres -c "
  SELECT count(*) as connections, state 
  FROM pg_stat_activity 
  GROUP BY state;
"
```

**Resolución**:

**Si es CPU-bound**:
```bash
# Escalar horizontalmente (agregar más instancias)
# O verticalmente (más CPU cores)
```

**Si es DB-bound**:
```sql
-- Identificar queries lentas
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Agregar índices si es necesario
-- (Consultar con DBA)
```

**Si es Worker Pool**:
```bash
# Ver sección "Worker Pool Saturado" arriba
```

---

### Memoria del Servidor Crece Continuamente

**Síntomas**:
- ⚠️ Memoria > 90%
- ⚠️ Eventualmente el servidor crashea (OOM)

**Diagnóstico** (10 minutos):
```bash
# 1. Verificar uso de memoria
free -m

# 2. Generar heap snapshot
node --inspect server/index.ts
# (Conectar con Chrome DevTools y tomar heap snapshot)

# 3. Revisar logs por memory leaks
cat server.log | grep -i "memory\|heap"
```

**Resolución Inmediata**:
```bash
# Reiniciar servidor para liberar memoria
npm restart
```

**Resolución a Largo Plazo**:
- Analizar heap snapshot para identificar memory leaks
- Implementar límites de memoria en workers
- Agregar memoria al servidor
- Implementar garbage collection tuning

---

## 🔐 Problemas de Seguridad

### Vault Tampering Detectado

**Síntomas**:
- 🚨 Alertas de modificación de logs
- 🚨 Registros en `vault_tampering_attempts`

**Diagnóstico** (5 minutos):
```sql
-- Verificar intentos de modificación
SELECT * FROM vault_tampering_attempts 
ORDER BY created_at DESC 
LIMIT 10;

-- Identificar usuario
SELECT vta.*, u.email, u.tenant_id 
FROM vault_tampering_attempts vta
JOIN users u ON vta.user_id = u.id
ORDER BY vta.created_at DESC;
```

**Resolución Inmediata** (10 minutos):
```bash
# 1. Bloquear usuario inmediatamente
psql -h <db-host> -d postgres -c "
  UPDATE users 
  SET habilitado = false 
  WHERE id = '<suspicious-user-id>';
"

# 2. Revocar tokens activos del usuario
psql -h <db-host> -d postgres -c "
  DELETE FROM user_sessions 
  WHERE user_id = '<suspicious-user-id>';
"

# 3. Notificar a Security Team
# [Enviar alerta urgente]
```

**Post-Incident**:
- Auditar todos los accesos del usuario:
```sql
SELECT * FROM vault_access_log 
WHERE user_id = '<suspicious-user-id>' 
ORDER BY created_at DESC;
```
- Cambiar contraseñas de cuentas sensibles
- Revisar permisos de usuarios similares

---

### Certificado Expirado

**Síntomas**:
- ❌ Facturas no se pueden firmar
- ❌ Logs muestran "Certificate expired"

**Diagnóstico** (2 minutos):
```bash
# Verificar certificados expirados
curl http://localhost:5000/api/admin/certificate-alerts \
  -H "Authorization: Bearer <admin-token>" | jq '.expired'
```

**Resolución** (15 minutos):
```bash
# 1. Contactar al tenant para obtener nuevo certificado
# 2. Subir nuevo certificado vía UI o API

curl -X POST http://localhost:5000/api/admin/certificates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "tenant_id": "<tenant-id>",
    "p12_base64": "<nuevo-certificado-base64>",
    "password": "<password>"
  }'

# 3. Verificar que funciona
curl -X POST http://localhost:5000/api/dtes/test-sign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tenant-token>" \
  -d '{"test": true}'
```

---

## 🔄 Problemas de Cron Jobs

### Catalog Sync No Ejecuta a las 2:00 AM

**Síntomas**:
- ⚠️ No hay logs de CatalogSync a las 2:00 AM
- ⚠️ Catálogos no se actualizan

**Diagnóstico** (3 minutos):
```bash
# 1. Verificar que el servidor estaba corriendo a las 2:00 AM
# (Revisar uptime o systemd status)

# 2. Buscar errores en logs
cat server.log | grep "CatalogSync" | grep "$(date +%Y-%m-%d)"

# 3. Verificar que el scheduler está activo
cat server.log | grep "Scheduler de sincronización de catálogos iniciado"
```

**Resolución**:
```bash
# Opción 1: Forzar sincronización manual
curl -X POST http://localhost:5000/api/admin/catalogs/sync \
  -H "Authorization: Bearer <admin-token>"

# Opción 2: Si el scheduler no está activo, reiniciar servidor
npm restart

# Verificar que se inicia correctamente
tail -f server.log | grep "Scheduler de sincronización"
```

---

### Feature Flags Auto-Rollout No Ejecuta

**Síntomas**:
- ⚠️ No hay logs "Auto-rollout" cada 15 min
- ⚠️ porcentaje_rollout no aumenta

**Diagnóstico** (3 minutos):
```bash
# 1. Verificar logs de scheduler
cat server.log | grep "Scheduler de auto-rollout de feature flags iniciado"

# 2. Verificar que hay flags con estrategia gradual
psql -h <db-host> -d postgres -c "
  SELECT id, key, estrategia, porcentaje_rollout, habilitado 
  FROM feature_flags 
  WHERE estrategia = 'gradual';
"

# 3. Buscar errores
cat server.log | grep -i "auto-rollout.*error"
```

**Resolución**:
```bash
# Opción 1: Si no hay flags graduales, crear uno de prueba
curl -X POST http://localhost:5000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "key": "test_gradual",
    "nombre": "Test Gradual",
    "estrategia": "gradual",
    "habilitado": true,
    "porcentaje_rollout": 0
  }'

# Opción 2: Si el scheduler no está activo, reiniciar
npm restart
```

---

## 📞 Escalación

### Matriz de Escalación

| Problema | Tiempo Inicial | Escalar A | Después De |
|----------|----------------|-----------|------------|
| Servidor caído (P0) | DevOps | Tech Lead | 10 min |
| BD inaccesible (P0) | DevOps | DBA | 10 min |
| Circuit breaker abierto | DevOps | - | 30 min |
| Worker pool saturado | DevOps | - | 30 min |
| Feature flag con errores | DevOps | Dev Team | 15 min |
| Vault tampering | DevOps | Security | Inmediato |
| Memory leak | DevOps | Dev Team | 1 hora |

---

## 📚 Referencias Rápidas

### Comandos Útiles

```bash
# Health check
curl http://localhost:5000/api/health

# Health check detallado
curl http://localhost:5000/api/health/detailed -H "Authorization: Bearer <token>"

# Ver logs en tiempo real
tail -f server.log

# Buscar errores
cat server.log | grep -i error | tail -20

# Reiniciar servidor
npm restart

# Verificar proceso
ps aux | grep node

# Verificar puerto
netstat -tulpn | grep :5000
```

### Archivos Importantes

| Archivo | Propósito |
|---------|-----------|
| `server/index.ts` | Entry point del servidor |
| `server.log` | Logs de aplicación |
| `.env` | Configuración y credenciales |
| `package.json` | Dependencias |
| `drizzle.config.ts` | Configuración de BD |

---

**Última actualización**: 18 de enero de 2026  
**Mantener actualizado**: Cada vez que se detecte un nuevo problema

Para operaciones de rutina, ver [OPERATIONS_GUIDE.md](OPERATIONS_GUIDE.md)
