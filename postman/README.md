# 📮 Postman Collection - FacturaXpress API

**Versión**: 2.1.0  
**Fecha**: 18 de enero de 2026

---

## 📚 Contenido

- `FacturaXpress_API.postman_collection.json` - Colección completa de endpoints
- `FacturaXpress_Local.postman_environment.json` - Variables de entorno para desarrollo local

---

## 🚀 Quick Start

### 1. Importar Colección en Postman

1. Abrir Postman Desktop o Web
2. Click en **Import** (botón superior izquierdo)
3. Seleccionar **Upload Files**
4. Importar ambos archivos:
   - `FacturaXpress_API.postman_collection.json`
   - `FacturaXpress_Local.postman_environment.json`

### 2. Configurar Environment

1. Seleccionar el environment **FacturaXpress - Local** en el dropdown (esquina superior derecha)
2. Click en el ícono de "ojo" → **Edit**
3. Completar las variables necesarias:

| Variable | Descripción | Valor Inicial |
|----------|-------------|---------------|
| `base_url` | URL del servidor | `http://localhost:5000` |
| `access_token` | Token de autenticación | (se auto-completa con Login) |
| `admin_token` | Token de admin | (manual) |
| `tenant_id` | ID del tenant de prueba | `test-tenant` |

### 3. Ejecutar Primer Request

**Login (para obtener token)**:
1. Expandir **Authentication** → **Login**
2. Editar el body con credenciales válidas:
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```
3. Click en **Send**
4. El token se guardará automáticamente en `access_token`

**Verificar que funciona**:
1. Ir a **Health** → **Health Check**
2. Click en **Send**
3. Deberías ver: `{"status":"ok"}`

---

## 📋 Estructura de la Colección

### 1. Authentication
- **Login** - Autenticar usuario y obtener token
- **Register** - Registrar nuevo usuario

### 2. Health
- **Health Check** - Verificar que el servidor está vivo
- **Health Check Detailed** - Estado detallado (circuit breaker, workers, etc.)

### 3. Feature Flags
- **Get All Feature Flags** - Listar todos los feature flags
- **Get Feature Flag by Key** - Obtener flag específico
- **Create Feature Flag** - Crear nuevo feature flag
- **Update Feature Flag** - Actualizar feature flag (ej: kill switch)
- **Evaluate Feature Flag** - Evaluar si un flag está habilitado para el usuario actual

### 4. Catalogos DGII
- **Get Catalog Versions** - Obtener versiones actuales de catálogos
- **Force Catalog Sync** - Forzar sincronización manual
- **Get Sync History** - Historial de sincronizaciones
- **Get Sync Alerts** - Alertas de cambios significativos

### 5. Sigma JIT
- **Create JIT Request** - Solicitar acceso temporal JIT
- **Review JIT Request** - Aprobar/rechazar solicitud
- **List JIT Requests** - Listar solicitudes pendientes
- **Extend JIT Access** - Extender acceso actual
- **Revoke JIT Access** - Revocar acceso inmediatamente

### 6. DTEs
- **Create Factura** - Crear nueva factura electrónica
- **Get DTE by ID** - Obtener DTE específico
- **List DTEs** - Listar DTEs con filtros
- **Validate DTE** - Validar DTE contra esquema DGII

### 7. Stock en Tránsito
- **Get Stock Movements** - Obtener movimientos de inventario
- **Get Transport Efficiency** - Métricas de eficiencia de transporte

### 8. Worker Metrics
- **Get Worker Metrics** - Métricas del pool de workers (firmas)

---

## 🔐 Autenticación

### Configuración de Bearer Token

La colección usa **Bearer Token** automáticamente con la variable `{{access_token}}`.

**Flujo normal**:
1. Ejecutar **Login** → guarda token automáticamente
2. Todos los demás requests usan ese token automáticamente
3. Si el token expira, volver a ejecutar **Login**

**Autenticación manual** (si el script no funciona):
1. Copiar el token de la respuesta del Login
2. Ir a **Authorization** tab en el request
3. Seleccionar **Bearer Token**
4. Pegar el token manualmente

---

## 🧪 Casos de Uso Comunes

### Caso 1: Probar Feature Flag Gradual

```
1. Login → obtener token
2. Create Feature Flag con estrategia "gradual"
   Body:
   {
     "key": "test_rollout",
     "nombre": "Test Gradual Rollout",
     "estrategia": "gradual",
     "habilitado": true,
     "porcentaje_rollout": 0
   }
3. Esperar 15 minutos
4. Get Feature Flag by Key → verificar que porcentaje_rollout aumentó a 10%
5. Esperar otros 15 minutos
6. Get Feature Flag by Key → verificar que porcentaje_rollout = 20%
```

### Caso 2: Probar Catalog Sync

```
1. Login → obtener token de admin
2. Get Catalog Versions → ver versiones actuales
3. Force Catalog Sync → forzar sincronización
4. Get Sync History → verificar última sincronización exitosa
```

### Caso 3: Workflow JIT Completo

```
1. Login como admin
2. Create JIT Request → crear solicitud de acceso
   Copiar request_id de la respuesta
3. Review JIT Request → aprobar solicitud
   Copiar access_token de la respuesta
4. (Después de 2 horas) Extend JIT Access → extender acceso
5. (Al terminar) Revoke JIT Access → revocar acceso
```

### Caso 4: Crear y Firmar Factura

```
1. Login → obtener token
2. Create Factura → crear nueva factura
   Copiar dte_id de la respuesta
3. Get DTE by ID → verificar que se firmó correctamente
   Verificar campo "documento" contiene JWS
```

---

## 🔧 Variables de Environment

### Variables Automáticas

Estas se auto-completan mediante scripts:

| Variable | Se completa en | Script |
|----------|----------------|--------|
| `access_token` | Login | `pm.environment.set('access_token', jsonData.token)` |
| `user_id` | Login | `pm.environment.set('user_id', jsonData.userId)` |

### Variables Manuales

Estas debes completarlas manualmente:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `admin_token` | Token de admin | `eyJhbGciOiJIUzI1...` |
| `flag_key` | Key del feature flag | `new_payment_method` |
| `dte_id` | ID del DTE | `dte-abc123` |
| `request_id` | ID de solicitud JIT | `req-abc123` |
| `extension_id` | ID de extensión JIT | `ext-abc123` |

### Cómo editar variables manualmente

1. Click en el ícono de "ojo" (esquina superior derecha)
2. Click en **Edit** junto al environment
3. Completar la columna **Current Value**
4. Click en **Save**

---

## 🎯 Tests Automatizados

### Tests Incluidos

**Login**:
- Guarda `access_token` automáticamente
- Guarda `user_id` automáticamente

### Agregar Tests Personalizados

Ejemplo para validar status 200:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});
```

Ejemplo para validar campo específico:
```javascript
pm.test("Response has status field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('status');
    pm.expect(jsonData.status).to.eql('ok');
});
```

---

## 🚨 Troubleshooting

### Error: "Unauthorized" (401)

**Causa**: Token expirado o inválido

**Solución**:
1. Ejecutar **Login** nuevamente
2. Verificar que `access_token` tiene un valor válido en el environment

### Error: "Connection refused" (ERR_CONNECTION_REFUSED)

**Causa**: Servidor no está corriendo

**Solución**:
```bash
cd /path/to/FacturaXpress
npm run dev
```

### Error: "Request Timeout"

**Causa**: Servidor lento o endpoint bloqueado

**Solución**:
1. Aumentar el timeout en Postman Settings
2. Revisar logs del servidor: `tail -f server.log`

### Variables no se auto-completan

**Causa**: Script de test no se ejecutó

**Solución**:
1. Verificar que la pestaña **Tests** tiene código
2. Ejecutar el request de nuevo
3. Verificar que la respuesta es 200 OK

---

## 📝 Notas Adicionales

### Para Producción

Crear un nuevo environment **FacturaXpress - Production**:
```json
{
  "base_url": "https://api.facturaxpress.com",
  "access_token": "",
  "admin_token": ""
}
```

### Exportar Colección Actualizada

Si agregas nuevos requests:
1. Click derecho en la colección → **Export**
2. Seleccionar **Collection v2.1 (recommended)**
3. Guardar en `postman/FacturaXpress_API.postman_collection.json`
4. Commit y push al repositorio

### Compartir con el Equipo

1. Exportar colección y environment
2. Subir al repositorio Git
3. Compartir instrucciones de este README

**Alternativa**: Usar Postman Workspaces compartidos (requiere cuenta Postman)

---

## 🔗 Referencias

- [Documentación API](../README.md)
- [Deployment Guide](../DEPLOYMENT_COMPLETE.md)
- [Operations Guide](../OPERATIONS_GUIDE.md)
- [Postman Documentation](https://learning.postman.com/docs/getting-started/introduction/)

---

**Última actualización**: 18 de enero de 2026  
**Mantenedor**: DevOps Team

Para reportar issues con la colección, abrir un issue en GitHub.
