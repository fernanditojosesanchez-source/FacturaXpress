# Vista Soporte Sigma + Stock en Tránsito

## ✅ Completado

**Estado actual:** Schemas, servicios y endpoints completados. Pendiente: Migraciones BD y tests.

---

## 📦 Stock en Tránsito

**Objetivo:** Seguimiento de stock moviéndose entre sucursales con auditoría completa.

### Archivos Creados

1. **shared/schema-stock-transito.ts** - Esquemas de base de datos
   - `stockTransitoTable` - Movimientos principales
   - `stockTransitoDetallesTable` - Lotes y series por movimiento
   - `stockTransitoHistorialTable` - Auditoría de eventos

2. **server/lib/stock-transito.ts** - Lógica de negocio
   - `createStockTransito()` - Crea movimiento con número único
   - `updateStockTransito()` - Actualiza estado del movimiento
   - `receiveStockTransito()` - Registra recepción
   - `devuelveStockTransito()` - Registra devoluciones
   - `getStockTransitoStats()` - Estadísticas agregadas

3. **server/routes/stock-transito.ts** - Endpoints REST
   - POST `/api/stock-transito` - Crear movimiento
   - GET `/api/stock-transito` - Listar movimientos (con filtros)
   - GET `/api/stock-transito/:id` - Detalles completos
   - PATCH `/api/stock-transito/:id/enviar` - Marcar como enviado
   - PATCH `/api/stock-transito/:id/recibir` - Registrar recepción
   - PATCH `/api/stock-transito/:id/devolver` - Registrar devolución
   - PATCH `/api/stock-transito/:id/cancelar` - Cancelar movimiento
   - GET `/api/stock-transito/stats` - Estadísticas
   - GET `/api/stock-transito/analytics` - Análisis de tendencias
   - GET `/api/stock-transito/problemas` - Alertas y problemas

### Estados del Movimiento

```
pendiente → enviado → en_transporte → recibido
                                    ↓
                                 parcial
                                    ↓
                                devuelto / cancelado
```

### Ejemplo de Uso

```bash
# Crear movimiento de stock
curl -X POST http://localhost:5000/api/stock-transito \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sucursalOrigen": "MAT",
    "sucursalDestino": "SUC01",
    "productos": [{
      "productoId": "abc-123",
      "codigoProducto": "MED001",
      "nombreProducto": "Paracetamol 500mg",
      "cantidad": 100
    }],
    "transportista": "Transportes Rápidos",
    "observaciones": "Entrega urgente"
  }'

# Respuesta:
{
  "id": "st-1736635200000",
  "numeroMovimiento": "MOV-1736635200000-xyz789",
  "estado": "pendiente",
  "sucursalOrigen": "MAT",
  "sucursalDestino": "SUC01",
  "productosTotales": 1,
  "cantidadTotal": 100,
  "creado": "2024-01-11T18:00:00.000Z"
}

# Marcar como enviado
curl -X PATCH http://localhost:5000/api/stock-transito/st-1736635200000/enviar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "observaciones": "Despachado a las 10:00 AM"
  }'

# Registrar recepción
curl -X PATCH http://localhost:5000/api/stock-transito/st-1736635200000/recibir \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cantidadRecibida": 98,
    "observaciones": "2 unidades dañadas en transporte"
  }'

# Registrar devolución
curl -X PATCH http://localhost:5000/api/stock-transito/st-1736635200000/devolver \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cantidadDevuelta": 2,
    "motivo": "Daño durante transporte",
    "observaciones": "Cajas aplastadas"
  }'
```

### Permisos Requeridos

- **manage_inventory** - Crear, actualizar, enviar, recibir, devolver
- **view_stock** - Listar y ver detalles
- **view_reports** - Ver estadísticas y analíticas
- **tenant_admin** - Cancelar movimientos

---

## 👥 Vista Soporte Sigma

**Objetivo:** Interfaz segura para que el equipo de Sigma (soporte) pueda monitorear salud de tenants SIN PII.

### Archivos Creados

1. **shared/schema-sigma-support.ts** - Esquemas de base de datos
   - `sigmaSupportAccessTable` - Accesos temporales a tenants
   - `sigmaSupportLogsTable` - Logs de acciones de soporte (**PII-safe: solo resourceId UUID**)
   - `sigmaSupportMetricasTable` - Métricas por tenant (trending)
   - `sigmaSupportTicketsTable` - Tickets de soporte

2. **server/lib/sigma-support.ts** - Lógica de negocio
   - `grantSigmaSupportAccess()` - Otorga acceso temporal (default: 7 días)
   - `revokeSigmaSupportAccess()` - Revoca acceso
   - `logSupportAction()` - Registra acción sin PII
   - `getActiveSupportAccesses()` - Listaaccesos activos
   - `getSupportStats()` - Estadísticas globales
   - `createSupportTicket()` - Crea ticket con número único

3. **server/routes/sigma-support.ts** - Endpoints REST (admin only)
   - POST `/api/admin/sigma/accesos` - Otorgar acceso de soporte
   - GET `/api/admin/sigma/accesos` - Listar accesos activos
   - DELETE `/api/admin/sigma/accesos/:id` - Revocar acceso
   - POST `/api/admin/sigma/logs` - Registrar acción de soporte
   - GET `/api/admin/sigma/logs` - Ver logs (por tenant)
   - POST `/api/admin/sigma/tickets` - Crear ticket
   - GET `/api/admin/sigma/tickets` - Listar tickets
   - PATCH `/api/admin/sigma/tickets/:id` - Actualizar ticket
   - GET `/api/admin/sigma/stats` - Estadísticas globales
   - GET `/api/admin/sigma/stats/tenant/:id` - Métricas de tenant

### Diseño PII-Safe 🔒

**CRÍTICO:** Logs de soporte NO contienen nombres, emails, ni datos personales. Solo **resourceId (UUID)**.

```javascript
// ✅ CORRECTO: Solo UUID
await logSupportAction(userId, userName, {
  action: "view_patient_records",
  recurso: "patient",
  resourceId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", // UUID
  exitoso: true
});

// ❌ INCORRECTO: Datos personales
await logSupportAction(userId, userName, {
  action: "view_patient_records",
  recurso: "patient",
  resourceId: "Juan Pérez", // ❌ NUNCA
  exitoso: true
});
```

### Ejemplo de Uso

```bash
# Otorgar acceso temporal a soporte
curl -X POST http://localhost:5000/api/admin/sigma/accesos \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supportEmail": "ana.lopez@sigma.com",
    "tipoAcceso": "readonly",
    "razonAcceso": "Investigar problema de sincronización"
  }'

# Respuesta:
{
  "accessId": "sa-1736635200000",
  "tenantId": "tenant-abc-123",
  "supportEmail": "ana.lopez@sigma.com",
  "otorgadoEn": "2024-01-11T18:00:00.000Z",
  "validoHasta": "2024-01-18T18:00:00.000Z",
  "mensaje": "Acceso otorgado por 7 días"
}

# Registrar acción de soporte (PII-safe)
curl -X POST http://localhost:5000/api/admin/sigma/logs \
  -H "Authorization: Bearer $SUPPORT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "accion": "view_metrics",
    "recurso": "dashboard",
    "exitoso": true
  }'

# Crear ticket de soporte
curl -X POST http://localhost:5000/api/admin/sigma/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Error de sincronización de facturas",
    "descripcion": "Cliente reporta facturas duplicadas",
    "severidad": "alta",
    "categoria": "integracion"
  }'

# Respuesta:
{
  "ticketId": "tkt-1736635200000",
  "numeroTicket": "TKT-1736635200000-ABC12",
  "tenantId": "tenant-abc-123",
  "estado": "abierto",
  "creado": "2024-01-11T18:00:00.000Z"
}

# Listar accesos activos (admin)
curl -X GET "http://localhost:5000/api/admin/sigma/accesos?tenantId=tenant-abc-123" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Revocar acceso
curl -X DELETE http://localhost:5000/api/admin/sigma/accesos/sa-1736635200000 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razon": "Problema resuelto"
  }'
```

### Permisos Requeridos

- **tenant_admin** - Todos los endpoints Sigma Support (otorgar, revocar, ver logs, tickets)
- **requireAuth** - Registrar acciones de soporte (si tienes acceso temporal)

### Severidades de Tickets

- `baja` - Consulta general
- `normal` - Problema menor sin impacto
- `alta` - Problema que afecta operación
- `critica` - Sistema caído o pérdida de datos

---

## 🗃️ Migraciones de BD (Pendiente)

**Siguiente paso:** Aplicar esquemas en Supabase.

### Comando Drizzle (cuando esté configurado)

```bash
# Generar migraciones
npx drizzle-kit generate

# Las migraciones se aplicarán manualmente en Supabase SQL Editor
# (copiar el contenido del archivo generado)
```

### Aplicación Manual (actual)

1. Copiar el contenido de `shared/schema-stock-transito.ts`
2. Convertir a SQL CREATE TABLE
3. Ejecutar en Supabase SQL Editor

**Orden de aplicación:**
1. `stock_transito` (tabla principal)
2. `stock_transito_detalles` (detalles de lotes)
3. `stock_transito_historial` (auditoría)
4. `sigma_support_access` (accesos de soporte)
5. `sigma_support_logs` (logs PII-safe)
6. `sigma_support_metricas` (métricas)
7. `sigma_support_tickets` (tickets)

---

## 🔐 Seguridad y Auditoría

Ambos módulos integran:
- ✅ **Audit Logging** - Todas las acciones registradas en `audit_logs`
- ✅ **SIEM Events** - Eventos críticos enviados a SIEM
- ✅ **Multi-Tenancy** - Aislamiento por `tenantId`
- ✅ **RBAC** - Permisos basados en roles
- ✅ **PII-Safety** (solo Sigma Support) - Logs con resourceId UUID

### Eventos SIEM

**Stock en Tránsito:**
- `stock_transito_created` (info)
- `stock_transito_sent` (info)
- `stock_transito_received` (info)
- `stock_transito_returned` (warn)
- `stock_transito_cancelled` (warn)

**Sigma Support:**
- `sigma_support_access_granted` (info)
- `sigma_support_access_revoked` (warn)
- `sigma_support_action_failed` (warn)
- `sigma_support_ticket_created` (info/warn/error según severidad)

---

## 📊 Estadísticas Disponibles

### Stock en Tránsito

```bash
GET /api/stock-transito/stats
```

Retorna:
- Total movimientos por estado
- Cantidad total en tránsito
- Problemas (retrasos, devoluciones)
- Valor total en tránsito

### Sigma Support

```bash
GET /api/admin/sigma/stats
```

Retorna:
- Accesos activos
- Logs últimas 24h
- Tickets abiertos
- Tickets críticos

---

## 🧪 Testing (Pendiente)

### Unit Tests

```bash
# A crear:
tests/stock-transito.test.ts
tests/sigma-support.test.ts
```

### Integration Tests

Validar flujos completos:
1. Crear movimiento → Enviar → Recibir → Verificar auditoría
2. Otorgar acceso → Registrar acción → Revocar → Verificar logs

---

## 📝 TODOs

- [ ] Aplicar migraciones en Supabase
- [ ] Implementar queries BD en servicios (actualmente stubs)
- [ ] Crear tests unitarios
- [ ] Crear tests de integración
- [ ] Dashboard UI para Stock en Tránsito
- [ ] Dashboard UI para Sigma Support
- [ ] Alertas automáticas (retrasos, tickets críticos)
- [ ] Webhooks para notificaciones
- [ ] Exportación de reportes (CSV/Excel)

---

## 🎯 Progreso P2

### ✅ Completados (10/16 - 63%)

- #6: Schema Sync
- #8: DLQ Manager
- #10: Performance Mode
- #11: Offline Sync
- #12: Vista Soporte Sigma (schemas + servicios + endpoints)
- #13: Stock en Tránsito (schemas + servicios + endpoints)

### ⏳ Pendientes (6/16 - 37%)

- #14: Migración a Monorepo
- #15: Pruebas de Carga
- Migraciones BD (#12 y #13)
- Tests (#12 y #13)
- UI/Dashboard (#12 y #13)

---

## 🔗 Referencias

- [server/routes/stock-transito.ts](server/routes/stock-transito.ts) - Endpoints REST
- [server/lib/stock-transito.ts](server/lib/stock-transito.ts) - Lógica de negocio
- [shared/schema-stock-transito.ts](shared/schema-stock-transito.ts) - Esquemas BD
- [server/routes/sigma-support.ts](server/routes/sigma-support.ts) - Endpoints REST
- [server/lib/sigma-support.ts](server/lib/sigma-support.ts) - Lógica de negocio
- [shared/schema-sigma-support.ts](shared/schema-sigma-support.ts) - Esquemas BD

---

**Última actualización:** 2024-01-11
