# 🔧 Implementación: Sistema de Roles y Permisos

## ✅ Tareas Completadas

### 1️⃣ Schema de Base de Datos (`shared/schema.ts`)

**Tabla `users` extendida con:**

```typescript
// Campos nuevos:
- nombre: TEXT
- sucursales_asignadas: JSONB  // Array de UUIDs o null
- modulos_habilitados: JSONB   // Override de módulos
- telefono: TEXT
- activo: BOOLEAN
- ultimo_acceso: TIMESTAMP
- updated_at: TIMESTAMP

// Roles válidos (constraint):
role IN ('super_admin', 'tenant_admin', 'manager', 'cashier', 'accountant', 'sigma_readonly')
```

**Tabla `tenants` extendida:**
- `modules: JSONB` - Feature flags por tenant

**Nueva tabla `permission_changes`:**
- Auditoría de cambios de permisos (quién cambió qué y cuándo)

### 2️⃣ Migración SQL (`server/migrations/001_add_roles_and_modules.sql`)

- Agregar columnas a tabla `users`
- Agregar constraint de roles válidos
- Crear índices para búsquedas rápidas
- Crear tabla `permission_changes` para auditoría
- Documentación inline en la base de datos

### 3️⃣ Middleware de Autenticación y Permisos (`server/auth.ts`)

**Funciones añadidas:**

#### `getPermissionsByRole(role)`
- Retorna array de permisos según el rol
- **Todos los roles tienen los mismos permisos** (sin discriminación por origen)

#### `checkPermission(permission)`
- Middleware que valida si usuario tiene permiso
- Retorna 403 Forbidden si no tiene acceso

#### `checkBranchAccess()`
- Valida que el usuario pueda acceder a la sucursal solicitada
- `manager` y `cashier` deben estar en `sucursales_asignadas`
- `tenant_admin` accede a todas

#### `checkModuleEnabled(module)`
- Valida si módulo está habilitado para usuario
- Primero chequea `modulos_habilitados` del usuario
- Si no hay override, usa `modules` del tenant

#### Helpers de Validación:
- `canManageUser()` - ¿Puede gestionar otro usuario?
- `isValidRoleChange()` - ¿Es válido asignar este rol?
- `getModulesForUser()` - Obtener módulos disponibles

### 4️⃣ Métodos en Storage (`server/storage.ts`)

**Nuevos métodos IStorage:**

```typescript
updateUserPermissions(userId, {
  role?: string;
  sucursales_asignadas?: string[] | null;
  modulos_habilitados?: Record<string, boolean> | null;
}): Promise<void>

listUsersByTenant(tenantId): Promise<any[]>

deleteUser(userId): Promise<void>
```

**Implementación en DatabaseStorage:**
- Actualización segura de permisos
- Listado de usuarios por tenant
- Eliminación segura de usuarios

### 5️⃣ Ejemplos de Rutas (`server/routes/users.example.ts`)

5 endpoints implementados:

1. **GET** `/api/tenants/:tenantId/users` - Listar usuarios
2. **POST** `/api/tenants/:tenantId/users` - Crear usuario
3. **PATCH** `/api/tenants/:tenantId/users/:userId/permissions` - Actualizar permisos
4. **POST** `/api/tenants/:tenantId/facturas` - Crear factura (con validaciones)
5. **DELETE** `/api/tenants/:tenantId/users/:userId` - Eliminar usuario

Cada uno incluye:
- Validación de permisos
- Validación de tenant
- Validación de roles
- Documentación inline

---

## 📊 Matriz de Control de Acceso

### Por Rol:

| Rol | Permisos | Sucursales | Módulos |
|-----|----------|-----------|---------|
| **super_admin** | Todos | Acceso global | Todos |
| **tenant_admin** | Todos dentro tenant | Acceso total | Hereda tenant |
| **manager** | Solo sucursal | Asignadas | Solo lectura |
| **cashier** | Facturación básica | Asignadas | Solo facturación |
| **accountant** | Reportes + descargas | N/A | Solo reportes |
| **sigma_readonly** | Solo consulta | N/A | Consulta básica |

### Control de Sucursales:

```json
{
  "id": "user-123",
  "role": "manager",
  "sucursales_asignadas": ["uuid-sucursal-1", "uuid-sucursal-2"]
  // null = acceso a todas (solo para tenant_admin)
}
```

### Control de Módulos:

```json
{
  "id": "user-456",
  "role": "accountant",
  "modulos_habilitados": {
    "inventario": false,
    "facturacion": false,
    "reportes": true,
    "contabilidad": true,
    "multi_sucursal": false
  }
  // null = heredar de tenant.modules
}
```

---

## 🔀 Flujo de Validación de Permiso

```
Usuario hace REQUEST
    ↓
requireAuth (¿Token válido?)
    ↓ ✅
checkPermission ("create_invoice") (¿Rol tiene permiso?)
    ↓ ✅
checkBranchAccess (¿Sucursal asignada?)
    ↓ ✅
checkModuleEnabled ("facturacion") (¿Módulo habilitado?)
    ↓ ✅
Proceder a ruta
```

---

## 💻 Uso en Rutas

### Ejemplo 1: Crear factura (con todas las validaciones)

```typescript
app.post(
  "/api/facturas",
  requireAuth,                      // ¿Autenticado?
  checkPermission("create_invoice"), // ¿Permiso de crear?
  checkBranchAccess,                // ¿Sucursal permitida?
  checkModuleEnabled("facturacion"), // ¿Módulo activo?
  async (req, res) => {
    // Seguro crear factura
  }
);
```

### Ejemplo 2: Gestionar usuarios (solo tenant_admin)

```typescript
app.post(
  "/api/tenants/:tenantId/users",
  requireAuth,
  requireTenantAdmin,           // ¿Es tenant_admin?
  checkPermission("manage_users"), // ¿Permiso de gestionar?
  async (req, res) => {
    // Crear usuario con validaciones
    const validation = isValidRoleChange(actor, newRole);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.reason });
    }
  }
);
```

---

## 🔑 Puntos Clave

### ✅ NO hay Restricción por Origen

- Médico Sigma = Ferretería Cliente Directo (mismos permisos técnicos)
- Solo difieren en qué **módulos usan**, no en capacidad técnica
- El campo `sucursales_asignadas` controla acceso a sucursales específicas

### ✅ Control Granular

- `role`: Qué operaciones puede hacer
- `sucursales_asignadas`: A cuáles sucursales tiene acceso
- `modulos_habilitados`: Qué funcionalidades ve en la UI

### ✅ Auditoría Incluida

- `ultimo_acceso`: Tracking de última actividad
- `permission_changes`: Histórico de cambios de permisos
- Quién cambió qué y cuándo

### ✅ Escalable

- Fácil agregar nuevos roles: solo extender `getPermissionsByRole()`
- Fácil agregar nuevos permisos: solo usar `checkPermission()`
- Fácil agregar nuevos módulos: solo extender `modulos_habilitados`

---

## 🚀 Próximos Pasos (Implementación)

### Paso 2: Aplicar Migración

```bash
# En terminal (cuando esté lista):
npm run migrate
```

### Paso 3: Actualizar UI

- Mostrar/ocultar botones según `checkPermission()`
- Mostrar/ocultar módulos según `modulos_habilitados`
- Mostrar sucursales según `sucursales_asignadas`

### Paso 4: Crear Rutas de Usuarios

- Implementar endpoints del archivo `users.example.ts`
- Validar entrada (zod)
- Manejar errores

### Paso 5: Integración en Rutas Existentes

- Proteger `/api/facturas` con `checkPermission("create_invoice")`
- Proteger `/api/reportes` con `checkPermission("view_reports")`
- etc.

---

## 📝 Ejemplo Completo: Dr. Juan

### Setup

```bash
# 1. crear tenant para Dr. Juan (ya existe)
# tenantId = "uuid-juan-123"
```

### Crear usuario tenant_admin

```javascript
POST /api/tenants/uuid-juan-123/users
{
  "username": "dr-juan@example.com",
  "password": "hash...",
  "nombre": "Dr. Juan López",
  "email": "dr-juan@example.com",
  "role": "tenant_admin",
  "sucursales_asignadas": null,  // Acceso a todas
  "modulos_habilitados": null    // Hereda del tenant
}
```

**JWT devuelto:**
```json
{
  "userId": "user-juan-1",
  "username": "dr-juan@example.com",
  "role": "tenant_admin",
  "tenantId": "uuid-juan-123",
  "sucursales_asignadas": null,
  "modulos_habilitados": null
}
```

### Crear contador

```javascript
POST /api/tenants/uuid-juan-123/users
{
  "username": "contador@drjuan.com",
  "password": "hash...",
  "nombre": "Roberto Contador",
  "email": "contador@drjuan.com",
  "role": "accountant",
  "modulos_habilitados": {
    "inventario": false,
    "facturacion": false,
    "reportes": true,
    "contabilidad": true,
    "multi_sucursal": false
  }
}
```

**JWT devuelto:**
```json
{
  "userId": "user-contador-1",
  "username": "contador@drjuan.com",
  "role": "accountant",
  "tenantId": "uuid-juan-123",
  "modulos_habilitados": {...}
}
```

### Contador intenta descargar libro

```javascript
GET /api/reportes/libro-iva
Authorization: Bearer <contador-jwt>

// ✅ Pasa: checkPermission("download_books") + accountant tiene permiso
// ✅ Retorna: Archivo Excel con Libro de IVA
```

### Contador intenta crear factura

```javascript
POST /api/facturas
Authorization: Bearer <contador-jwt>
{
  "items": [...],
  "cliente": {...}
}

// ❌ Falla: checkPermission("create_invoice")
// accountant NO tiene permiso "create_invoice"
// Error 403: "Sin permisos suficientes"
```

---

## 🎯 Resumen

| Aspecto | Implementado |
|--------|-------------|
| Schema DB | ✅ 3 tablas extendidas |
| Migración SQL | ✅ Listo para ejecutar |
| Middleware de permisos | ✅ 6 funciones |
| Helpers de validación | ✅ 3 funciones |
| Storage methods | ✅ 3 métodos nuevos |
| Rutas de ejemplo | ✅ 5 endpoints |
| Documentación | ✅ Completa |
| Auditoría | ✅ Tabla permission_changes |

**Status:** Listo para aplicar migración e implementar rutas 🚀
