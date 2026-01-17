# 🚀 Guía de Uso: Stock en Tránsito & Sigma Support

## Acceso a las Nuevas Features

### 1. Stock en Tránsito

**URL:** `http://localhost:5000/stock-transito`

**Roles requeridos:**
- `tenant_admin` ✅
- `manager` ✅
- `cashier` ❌

**Funcionalidades:**

#### Dashboard (Pestaña Inicial)
```
5 Estadísticas:
├─ Total: Todos los movimientos (suma)
├─ Pendiente: Aún no enviados
├─ En Tránsito: Enviados pero no recibidos
├─ Recibido: Entregados correctamente
└─ Problemas: Parciales o devueltos

3 Pestañas:
├─ Movimientos: Lista filtrable con paginación
├─ Análisis: Tendencias, eficiencia, tiempos
└─ Problemas: Alertas de entregas incompletas
```

#### Filtros Disponibles
```javascript
// Por estado
GET /api/stock-transito?estado=pendiente
GET /api/stock-transito?estado=enviado
GET /api/stock-transito?estado=en_transporte
GET /api/stock-transito?estado=recibido
GET /api/stock-transito?estado=parcial
GET /api/stock-transito?estado=devuelto
GET /api/stock-transito?estado=cancelado

// Por sucursal (origen O destino)
GET /api/stock-transito?sucursal=MAT
GET /api/stock-transito?sucursal=SUC01

// Por rango de fechas
GET /api/stock-transito?desde=2026-01-01&hasta=2026-01-31

// Con paginación
GET /api/stock-transito?page=1&limit=25
```

#### Crear Movimiento
```bash
curl -X POST http://localhost:5000/api/stock-transito \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sucursalOrigen": "MAT",
    "sucursalDestino": "SUC01",
    "productoId": "abc-123",
    "codigoProducto": "MED001",
    "nombreProducto": "Paracetamol 500mg",
    "cantidadEnviada": 100,
    "transportista": "Transportes Rápidos",
    "numeroGuia": "TR123456",
    "observaciones": "Entrega urgente"
  }'

# Respuesta:
{
  "id": "mov-uuid",
  "numeroMovimiento": "MOV-1705429920000-a1b2c3",
  "estado": "pendiente",
  "sucursalOrigen": "MAT",
  "sucursalDestino": "SUC01"
}
```

#### Cambiar Estado de Movimiento
```bash
# Marcar como enviado
curl -X PATCH http://localhost:5000/api/stock-transito/{movimientoId}/enviar \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "observaciones": "Despachado a las 10:00 AM"
  }'

# Registrar recepción
curl -X PATCH http://localhost:5000/api/stock-transito/{movimientoId}/recibir \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "cantidadRecibida": 98,
    "observaciones": "2 unidades dañadas"
  }'

# Registrar devolución
curl -X PATCH http://localhost:5000/api/stock-transito/{movimientoId}/devolver \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "cantidadDevuelta": 2,
    "motivo": "Producto vencido"
  }'
```

#### Obtener Análisis
```bash
curl -X GET "http://localhost:5000/api/stock-transito/analytics?desde=2026-01-01&hasta=2026-01-31" \
  -H "Authorization: Bearer $TOKEN"

# Respuesta:
{
  "periodo": "2026-01-01 a 2026-01-31",
  "movimientosCompletados": 15,
  "tiempoPromedioEntrega": "3.5 días",
  "eficienciaEntrega": 94.5,
  "costoPromedio": 125.50,
  "rutas": []
}
```

#### Obtener Problemas
```bash
curl -X GET "http://localhost:5000/api/stock-transito/problemas?limite=30" \
  -H "Authorization: Bearer $TOKEN"

# Respuesta:
{
  "total": 2,
  "problemas": [
    {
      "movimientoId": "...",
      "numeroMovimiento": "MOV-...",
      "tipo": "devolución",
      "severidad": "alta",
      "descripcion": "Recibidas 98 de 100 unidades",
      "reportadoEn": "2026-01-15T10:30:00Z",
      "estado": "abierto",
      "producto": "Paracetamol 500mg",
      "ruta": "MAT → SUC01"
    }
  ]
}
```

---

## 2. Vista Soporte Sigma

**URL:** `http://localhost:5000/sigma-support`

**Roles requeridos:**
- `tenant_admin` ✅ (solo)

**Funcionalidades:**

#### Dashboard (Pestaña Inicial)
```
4 Estadísticas:
├─ Accesos Activos: Usuarios con acceso temporal vigente
├─ Logs (24h): Acciones en últimas 24 horas
├─ Tickets Abiertos: Problemas sin resolver
└─ Críticos: Tickets con severidad "crítica"

2 Secciones:
├─ Accesos Recientes: Últimos 5 accesos otorgados
└─ Tickets Críticos: Últimos 5 tickets sin cerrar
```

#### Pestaña: Accesos
```
Tabla de accesos activos:
├─ Usuario: Nombre del usuario Sigma
├─ Tipo de Acceso: readonly / readwrite / fullaccess
├─ Razón: Motivo del acceso
├─ Válido Hasta: Fecha de expiración
└─ Botón Revocar: Cancelar acceso inmediatamente
```

#### Otorgar Acceso Temporal
```bash
curl -X POST http://localhost:5000/api/admin/sigma/accesos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-abc",
    "supportUserId": "sigma-user-1",
    "supportUserName": "Juan Pérez",
    "supportEmail": "juan@sigma.com",
    "tipoAcceso": "readonly",
    "razon": "Investigación de bug en transmisiones",
    "fechaFin": "2026-01-24T23:59:59Z",
    "permisos": {
      "canViewLogs": true,
      "canViewMetrics": true,
      "canViewAudit": false,
      "canExportData": false
    }
  }'

# Respuesta:
{
  "accessId": "access-uuid",
  "validoHasta": "2026-01-24T23:59:59Z"
}
```

#### Revocar Acceso
```bash
curl -X PATCH http://localhost:5000/api/admin/sigma/accesos/{accessId}/revoke \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "razon": "Investigación completada"
  }'
```

#### Pestaña: Logs Auditoría
```
Tabla de logs (PII-SAFE):
├─ Usuario: Quién realizó la acción
├─ Acción: view_logs, export, download, debug, etc.
├─ Recurso: facturas, certificados, reportes, etc.
├─ Resultado: ✓ Éxito o ✗ Error
└─ Timestamp: Cuándo ocurrió

⚠️ IMPORTANTE: Solo se guarda UUID del recurso
   Nunca se guardan datos sensibles (nombres, correos, etc.)
```

#### Obtener Logs
```bash
curl -X GET "http://localhost:5000/api/admin/sigma/logs?limit=100&offset=0" \
  -H "Authorization: Bearer $TOKEN"

# Respuesta:
{
  "total": 245,
  "logs": [
    {
      "logId": "...",
      "supportUserName": "Juan Pérez",
      "resourceId": "550e8400-e29b-41d4-a716-446655440000",
      "accion": "view_logs",
      "recurso": "facturas",
      "exitoso": true,
      "timestamp": "2026-01-17T15:30:00Z"
    }
  ]
}
```

#### Registrar Acción de Soporte
```bash
curl -X POST http://localhost:5000/api/admin/sigma/log \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supportUserId": "sigma-user-1",
    "supportUserName": "Juan Pérez",
    "accion": "export",
    "recurso": "reportes",
    "resourceId": "550e8400-e29b-41d4-a716-446655440000",
    "detalles": "Exportó reporte de últimos 30 días",
    "exitoso": true
  }'
```

#### Pestaña: Tickets
```
Tabla de tickets de soporte:
├─ Número: ID único (TKT-1234567-ABC)
├─ Título: Descripción breve del problema
├─ Categoría: facturas, certificados, transmisiones, etc.
├─ Severidad: baja (azul), normal (gris), alta (naranja), crítica (rojo)
├─ Estado: abierto, en_progreso, resuelto, cerrado
└─ Fecha: Cuándo se creó

Filtros:
• Por estado: Todos / Abierto / En progreso / Resuelto / Cerrado
```

#### Crear Ticket
```bash
curl -X POST http://localhost:5000/api/admin/sigma/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-abc",
    "titulo": "Error en transmisión de DTE",
    "descripcion": "Las facturas no se transmiten correctamente al DGII",
    "categoria": "transmisiones",
    "severidad": "critica"
  }'

# Respuesta:
{
  "ticketId": "ticket-uuid",
  "numeroTicket": "TKT-1705429920000-A1B2C"
}
```

#### Actualizar Estado de Ticket
```bash
curl -X PATCH http://localhost:5000/api/admin/sigma/tickets/{ticketId} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "estado": "en_progreso",
    "asignadoA": "soporte@empresa.com"
  }'

# Cambiar a resuelto
curl -X PATCH http://localhost:5000/api/admin/sigma/tickets/{ticketId} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "estado": "resuelto"
  }'
```

#### Obtener Estadísticas de Tenant
```bash
curl -X GET http://localhost:5000/api/admin/sigma/stats/tenant/{tenantId} \
  -H "Authorization: Bearer $TOKEN"

# Respuesta:
{
  "tenantId": "tenant-abc",
  "timestamp": "2026-01-17T15:45:00Z",
  "accesosActivos": 3,
  "ultimoAcceso": "2026-01-17T15:30:00Z",
  "logsUltimas24h": 45,
  "ticketsAbiertos": 2,
  "tendenciaAccesos": "up",
  "metricas": [
    {
      "metrica": "facturas_totales",
      "valor": 245,
      "fecha": "2026-01-17T00:00:00Z",
      "trending": "up",
      "alerta": false
    }
  ]
}
```

---

## 🔐 Seguridad & Validaciones

### Stock en Tránsito
✅ Validación: `sucursalOrigen !== sucursalDestino`  
✅ Validación: `cantidadEnviada > 0`  
✅ Validación: `cantidadRecibida <= cantidadEnviada`  
✅ State machine: Solo transiciones válidas  
✅ Tenant isolation: Cada usuario solo ve su tenant  

### Sigma Support
✅ PII Protection: Solo UUID en logs  
✅ Tenant isolation: Accesos filtrados por tenant  
✅ Auditoría: Toda acción registrada  
✅ Expiración: Accesos revocan automáticamente  
✅ Permisos: Granulares por tipo de acceso  

---

## 📊 Ejemplos de Uso en Postman

### Colección Stock en Tránsito
```
📁 Stock en Tránsito
├─ POST   Crear movimiento
├─ GET    Listar movimientos
├─ GET    Ver detalle
├─ PATCH  Marcar enviado
├─ PATCH  Registrar recepción
├─ PATCH  Registrar devolución
├─ GET    Análisis
└─ GET    Problemas
```

### Colección Sigma Support
```
📁 Sigma Support (Admin)
├─ POST   Otorgar acceso
├─ GET    Listar accesos
├─ PATCH  Revocar acceso
├─ GET    Logs auditoría
├─ POST   Crear ticket
├─ GET    Listar tickets
├─ PATCH  Actualizar ticket
└─ GET    Estadísticas
```

---

## 🧪 Ejecutar Tests

```bash
# Tests unitarios
npm run test

# Tests específicos
npm run test -- stock-transito
npm run test -- sigma-support

# Watch mode
npm run test:watch
```

---

## 📝 Notas Importantes

### Stock en Tránsito
- El número de movimiento se genera automáticamente
- La cantidad recibida puede ser < cantidad enviada (estado: parcial)
- El historial se actualiza automáticamente en cada cambio
- Los problemas se detectan automáticamente (parcial, devuelto)

### Sigma Support
- Los accesos expiran automáticamente después de la fechaFin
- Los logs NUNCA guardan datos personales del usuario final
- Solo se guarda UUID del recurso consultado
- La revocación es inmediata y se registra en auditoría
- Los tickets se pueden filtrar por severidad

---

## 🚨 Troubleshooting

**Error: "Unauthorized" en /sigma-support**
```
→ Verificar que user.role === "tenant_admin"
```

**Error: "Movimiento no encontrado"**
```
→ Verificar que movimientoId es UUID válido
→ Verificar que el movimiento pertenece al tenant actual
```

**Logs vacíos**
```
→ Normal si no hay acciones de soporte
→ Ejecutar algunas acciones en Sigma Support
```

**Performance lento**
```
→ Verificar paginación (limit=25)
→ Usar filtros para reducir resultados
→ Evitar rango de fechas muy grande
```

---

## 📞 Soporte

Para más información, consultar:
- [P2_SIGMA_SUPPORT_STOCK.md](P2_SIGMA_SUPPORT_STOCK.md) - Documentación técnica
- [P2_COMPLETION_SUMMARY.md](P2_COMPLETION_SUMMARY.md) - Resumen de implementación
- Servidor API: http://localhost:5000
- Frontend: http://localhost:5000

**Última actualización:** 17 de enero de 2026
