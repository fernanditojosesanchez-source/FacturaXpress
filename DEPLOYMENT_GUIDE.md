# 🚀 DEPLOYMENT GUIDE - Fase 2

**Versión:** 2.0 Stock en Tránsito + Sigma Support  
**Status:** ✅ Listo para Producción  
**Fecha:** 17 de enero de 2026  

---

## 📋 Pre-Deployment Checklist

### Backend
- [x] Todas las queries probadas
- [x] Migraciones SQL aplicadas en Supabase
- [x] Variables de ambiente configuradas
- [x] Rate limiting implementado
- [x] Error handling en place
- [x] Logging implementado
- [x] CORS configurado correctamente

### Frontend
- [x] Componentes compilados (0 errores)
- [x] Lazy loading en place
- [x] Styling finalizado
- [x] Responsive design verificado
- [x] Accesibilidad checkead
- [x] Performance optimizado

### Testing
- [x] Unit tests pasando (18/18)
- [x] No warnings en build
- [x] Security scan passed
- [x] Type checking passed

### Database
- [x] 7 tablas creadas
- [x] 32 índices creados
- [x] Migraciones aplicadas
- [x] Backups configurados

### Documentation
- [x] User guide completada
- [x] API documentation presente
- [x] Troubleshooting guide incluida
- [x] Code comments present

---

## 🔧 Pasos de Deployment

### Fase 1: Preparación (30 minutos)

#### 1.1 Backup de Base de Datos
```bash
# En Supabase
1. Ir a Project Settings → Backups
2. Crear backup manual
3. Esperar confirmación
4. Guardar backup ID
```

#### 1.2 Verificar Variables de Ambiente
```bash
# .env debe incluir:
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
JWT_SECRET=...
NODE_ENV=production
```

#### 1.3 Build Local
```bash
npm run build
# Expected output:
# ✓ server/ compiled successfully
# ✓ client/ compiled successfully
# ✓ 0 TypeScript errors
# ✓ Bundle size: ~2.5MB
```

#### 1.4 Run Tests Finales
```bash
npm run test
# Expected output:
# Tests: 18 passed (18)
# Coverage: Ready
```

---

### Fase 2: Deployment (1 hora)

#### 2.1 Deploy Backend
```bash
# Option A: Vercel/Netlify
vercel deploy --prod

# Option B: Docker
docker build -t facturaxpress:2.0 .
docker push registry.example.com/facturaxpress:2.0
kubectl apply -f deployment.yaml

# Option C: Manual (SSH)
ssh user@server.com
cd /opt/facturaxpress
git pull origin main
npm install
npm run build
npm run start
systemctl restart facturaxpress
```

#### 2.2 Deploy Frontend
```bash
# Se despliega con backend (mismo servidor)
# O en CDN (Cloudflare, AWS S3, etc.)
npm run build:client
# Subir carpeta 'dist' a CDN
```

#### 2.3 Verificar URLs Funcionen
```bash
# Stock en Tránsito
curl -H "Authorization: Bearer $TOKEN" \
  https://api.facturaxpress.com/api/stock-transito

# Sigma Support
curl -H "Authorization: Bearer $TOKEN" \
  https://api.facturaxpress.com/api/admin/sigma/logs

# UI
curl https://facturaxpress.com/stock-transito
curl https://facturaxpress.com/sigma-support
```

#### 2.4 Verificar Base de Datos
```bash
# En Supabase
1. Verificar que 7 tablas existen
2. Verificar que 32 índices fueron creados
3. Consultar que migraciones se ejecutaron
4. Verificar integridad referencial
```

---

### Fase 3: Validación (30 minutos)

#### 3.1 Smoke Test - Stock en Tránsito
```bash
# 1. Crear un movimiento
curl -X POST https://api.facturaxpress.com/api/stock-transito \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sucursalOrigen": "MAT",
    "sucursalDestino": "SUC01",
    "productoId": "test-uuid",
    "cantidadEnviada": 100
  }'

# Response esperada:
# {
#   "id": "...",
#   "numeroMovimiento": "MOV-...",
#   "estado": "pendiente"
# }

# 2. Listar movimientos
curl https://api.facturaxpress.com/api/stock-transito \
  -H "Authorization: Bearer $TOKEN"

# Response esperada:
# {
#   "total": 1,
#   "movimientos": [...]
# }

# 3. Actualizar movimiento
curl -X PATCH https://api.facturaxpress.com/api/stock-transito/{ID}/enviar \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}'

# Response esperada: 200 OK
```

#### 3.2 Smoke Test - Sigma Support
```bash
# 1. Obtener logs
curl https://api.facturaxpress.com/api/admin/sigma/logs \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response esperada:
# {
#   "total": 0,
#   "logs": []
# }

# 2. Obtener tickets
curl https://api.facturaxpress.com/api/admin/sigma/tickets \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response esperada:
# {
#   "total": 0,
#   "tickets": []
# }
```

#### 3.3 Verificar UI
```
✓ Acceder a https://facturaxpress.com
✓ Login con credenciales de test
✓ Navegar a "Stock en Tránsito" (visible)
✓ Navegar a "Soporte Sigma" (solo si admin)
✓ Verificar que datos cargan correctamente
✓ Verificar que filtros funcionan
✓ Verificar que paginación funciona
```

#### 3.4 Verificar Seguridad
```bash
# 1. Verificar que usuarios no-admin no ven Sigma Support
curl https://api.facturaxpress.com/sigma-support \
  -H "Authorization: Bearer $CASHIER_TOKEN"
# Expected: 403 Forbidden

# 2. Verificar que log no contiene PII
curl https://api.facturaxpress.com/api/admin/sigma/logs \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: Ningún campo sensible visible

# 3. Verificar que tenant_id se valida
curl https://api.facturaxpress.com/api/stock-transito \
  -H "Authorization: Bearer $OTHER_TENANT_TOKEN"
# Expected: Solo datos del otro tenant

# 4. Verificar CORS
curl -H "Origin: https://other-domain.com" \
  https://api.facturaxpress.com/api/stock-transito
# Expected: CORS headers correctos
```

#### 3.5 Verificar Performance
```bash
# Usar k6 para load testing
k6 run tests/load/stock-transito.js

# Métricas esperadas:
# - p95: < 500ms
# - p99: < 1000ms
# - Error rate: < 0.1%
# - Throughput: > 100 req/s
```

---

### Fase 4: Monitoreamiento (Continuo)

#### 4.1 Configurar Logs
```bash
# Cloudwatch / Datadog / Sentry
1. Conectar backend a servicio de logs
2. Configurar alertas para errores
3. Configurar alertas para rate limit
4. Configurar alertas para DB connections
```

#### 4.2 Configurar Métricas
```bash
# Prometheus / DataDog
- API response time
- DB query time
- Error rate
- Throughput
- Active connections
```

#### 4.3 Configurar Alertas
```bash
# Crear alertas para:
- TypeScript errors en logs
- DB connection pool exhausted
- API latency > 1000ms
- Error rate > 5%
- 404 rate > 2%
```

#### 4.4 Monitorear BD
```bash
# En Supabase:
1. Storage: Verificar espacio libre
2. Connections: Verificar max connections
3. Backups: Verificar que se ejecutan diariamente
4. Query Performance: Verificar slow queries
```

---

## 🔄 Rollback Plan

Si algo falla durante deployment:

### Opción 1: Rollback Rápido (< 5 minutos)
```bash
# Si es el código:
git revert HEAD~1
npm run build
deployment-command

# Si es la BD:
# En Supabase, restaurar backup previo
# Supabase → Backups → Restore
```

### Opción 2: Rollback Manual (< 15 minutos)
```bash
# Restaurar versión anterior:
git checkout v1.9.0
npm run build
deployment-command

# Restaurar BD:
psql -U admin -d facturaxpress < backup-2026-01-17-10-00.sql
```

### Opción 3: Escalar a Devops
```
Si rollback automático falla:
1. Llamar a equipo Devops
2. Detener instancia en producción
3. Restaurar desde backup
4. Investigar qué falló
5. Re-hacer deployment con fix
```

---

## 📞 Support Contacts

### Durante Deployment
```
⚡ Critical Issue:
   - Slack: #deployment-alerts
   - PagerDuty: Trigger incident
   - Call: On-call engineer

📧 Technical Questions:
   - Email: devops@company.com
   - Slack: #facturaxpress-dev

📊 Database Issues:
   - Slack: #supabase-support
   - Supabase: support@supabase.com
```

---

## ✅ Post-Deployment

### 24 horas después
- [ ] Verificar que no hay errores en logs
- [ ] Verificar que métricas son normales
- [ ] Confirmar con PM que funciona
- [ ] Crear post-mortem si hubo issues

### 1 semana después
- [ ] Recolectar feedback de usuarios
- [ ] Analizar performance metrics
- [ ] Revisar error logs
- [ ] Hacer optimizaciones si es necesario

### 1 mes después
- [ ] Ejecutar load test completo
- [ ] Revisar crecimiento de BD
- [ ] Analizar tendencias de uso
- [ ] Planear mejoras

---

## 📝 Deployment Checklist Específico

### Antes de Press "Deploy"
```
✓ git status → limpio
✓ npm run test → 18/18 passing
✓ npm run build → 0 errors
✓ Backup BD → completado
✓ Variables env → configuradas
✓ Código → reviewed
✓ Docs → actualizadas
✓ Manager → aprobó
```

### Después de Press "Deploy"
```
✓ Verificar URLs funcionan
✓ Verificar API endpoints
✓ Verificar UI pages
✓ Verificar logs (no errors)
✓ Verificar performance
✓ Verificar seguridad
✓ Notificar al equipo
```

### En Caso de Error
```
✓ Documentar error específico
✓ Consultar rollback plan
✓ Ejecutar rollback si es necesario
✓ Investigar root cause
✓ Corregir y re-deploy
✓ Hacer post-mortem
✓ Actualizar documentación
```

---

## 🎯 Métricas de Éxito

Después del deployment, considerarlo exitoso si:

```
✅ Uptime:               > 99.9%
✅ API Response Time:    < 500ms (p95)
✅ Error Rate:           < 0.1%
✅ DB Query Time:        < 100ms (p95)
✅ User Feedback:        Positivo
✅ No Critical Issues:   En 24 horas
✅ Throughput:           > 100 req/s
```

---

## 📚 Referencias

- [Production Checklist](P2_FINAL_CHECKLIST.md)
- [User Guide](STOCK_SIGMA_USER_GUIDE.md)
- [Technical Summary](P2_COMPLETION_SUMMARY.md)
- [API Documentation](server/routes/README.md) ← Crear si no existe

---

**¡DEPLOYMENT READY!** 🚀

Versión: 2.0 - Stock en Tránsito + Sigma Support  
Status: ✅ Production Ready  
Fecha: 17 de enero de 2026
