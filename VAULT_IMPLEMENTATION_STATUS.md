# 🔐 RESUMEN IMPLEMENTACIÓN SUPABASE VAULT

**Fecha:** 2026-01-14  
**Estado:** ✅ **ARQUITECTURA COMPLETA, LISTA PARA TESTING**  
**Responsable:** Sistema de Seguridad

---

## 📊 ESTADO ACTUAL

### ✅ COMPLETADO

| Componente | Archivo | Estado | Descripción |
|-----------|---------|--------|-----------|
| **Vault Service** | `server/lib/vault.ts` | ✅ Creado | 300+ líneas, 9 funciones, tipos completos |
| **Storage Integration** | `server/storage.ts` | ✅ Actualizado | 8 métodos nuevos para Vault |
| **Database Schema** | Migración aplicada | ✅ Creado | Tablas `vault_references`, `vault_access_log` |
| **Auditoría** | `vault_access_log` | ✅ Activa | Logs automáticos de acceso, usuario, IP, resultado |
| **Tenant Isolation** | RLS por aplicación | ✅ Implementada | Todos queries filtrados por tenant_id |
| **Type Safety** | `VaultSecretType` enum | ✅ Tipado | cert_p12, cert_password, mh_password, api_key |
| **Endpoints Demo** | `server/routes/certificados.ts` | ✅ Ejemplo | 4 endpoints para demostrar uso |
| **Testing Script** | `scripts/test-vault.ts` | ✅ Listo | 9 tests para verificar Vault funciona |
| **Documentación** | `VAULT_SECURITY_POLICY.md` | ✅ Completa | Guía de uso y seguridad |

### 🟡 PENDIENTE

| Tarea | Prioridad | Descripción |
|-------|----------|-----------|
| Tests automatizados en Jest | MEDIA | Crear suite de tests en `__tests__/vault.test.ts` |
| Migración de datos existentes | ALTA | Script para mover datos de `tenantCredentials` a Vault |
| Aplicar RLS en DB | BAJA | Requiere permisos Supabase (actualmente en app layer) |
| Endpoints en producción | ALTA | Integrar `certificados.ts` en server/index.ts |
| Dashboard de auditoría | BAJA | UI para revisar `vault_access_log` |

---

## 🗂️ ESTRUCTURA DE ARCHIVOS

```
FacturaXpress/
├── VAULT_SECURITY_POLICY.md          ← 📋 POLÍTICA DE SEGURIDAD
├── scripts/
│   └── test-vault.ts                 ← 🧪 SCRIPT DE TESTING (9 tests)
├── server/
│   ├── lib/
│   │   └── vault.ts                  ← 🔐 SERVICIO VAULT (300+ líneas)
│   ├── storage.ts                    ← 💾 INTEGRACIÓN STORAGE (actualizado)
│   └── routes/
│       └── certificados.ts           ← 🌐 ENDPOINTS EJEMPLO (4 rutas)
└── shared/
    └── schema.ts                     ← (Types + Supabase Database)
```

---

## 🔐 SERVICIOS DISPONIBLES

### Funciones en `server/lib/vault.ts`

```typescript
// Guardar secreto (encriptado automáticamente)
await saveSecretToVault(
  supabase,
  tenantId,
  secretType,     // "cert_p12" | "cert_password" | "mh_password" | ...
  secretContent,  // string o JSON
  referenceName,  // nombre lógico
  userId,
  ipAddress
);

// Leer secreto (desencriptado en memoria, server-side only)
const secret = await getSecretFromVault(
  supabase,
  tenantId,
  secretType,
  referenceName,
  userId,
  ipAddress
);

// Eliminar secreto (IRREVERSIBLE)
await deleteSecretFromVault(
  supabase,
  tenantId,
  secretType,
  referenceName,
  userId,
  ipAddress
);

// Verificar existencia sin decriptar
const exists = await secretExists(supabase, tenantId, secretType, referenceName);

// Listar metadatos (NUNCA retorna contenido)
const list = await listTenantSecrets(supabase, tenantId);
```

### Métodos en `server/storage.ts` (DatabaseStorage)

```typescript
// Certificados
await storage.saveCertificateToVault(tenantId, p12Base64, userId, ipAddress);
await storage.getCertificateFromVault(tenantId, userId, ipAddress);
await storage.saveCertificatePasswordToVault(tenantId, password, userId, ipAddress);
await storage.getCertificatePasswordFromVault(tenantId, userId, ipAddress);

// Credenciales MH
await storage.saveMHCredentialsToVault(tenantId, usuario, password, userId, ipAddress);
await storage.getMHCredentialsFromVault(tenantId, userId, ipAddress);

// Gestión
await storage.deleteCertificateSecretsFromVault(tenantId, userId, ipAddress);
```

---

## 📝 ESQUEMA DE BASE DE DATOS

### Tabla: `vault_references`
Mapea nombres lógicos a secretos encriptados en Vault.

```sql
CREATE TABLE public.vault_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,                    -- Tenant propietario
  secret_type VARCHAR(50) NOT NULL,          -- cert_p12, cert_password, mh_password, etc
  secret_id UUID NOT NULL,                    -- ID en vault.secrets (encriptado)
  reference_name VARCHAR(255) NOT NULL,      -- Nombre lógico (ej: "cert_principal")
  created_by UUID NOT NULL,                   -- Usuario que creó
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, secret_type, reference_name)
);

-- Índices para performance
CREATE INDEX idx_vault_ref_tenant_type ON vault_references(tenant_id, secret_type);
CREATE INDEX idx_vault_ref_tenant ON vault_references(tenant_id);
```

### Tabla: `vault_access_log`
Registro de auditoría de TODOS los accesos a Vault.

```sql
CREATE TABLE public.vault_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                               -- Quién accedió
  tenant_id UUID NOT NULL,                   -- A qué tenant
  action VARCHAR(50) NOT NULL,               -- read, write, delete, failed_access
  secret_type VARCHAR(50),                   -- Tipo de secreto
  success BOOLEAN NOT NULL,                  -- ✅ o ❌
  ip_address VARCHAR(45),                    -- IPv4 o IPv6
  user_agent TEXT,                           -- Browser/Cliente
  error_message TEXT,                        -- Si falló, por qué
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para auditoría y debugging
CREATE INDEX idx_vault_log_user ON vault_access_log(user_id);
CREATE INDEX idx_vault_log_tenant ON vault_access_log(tenant_id);
CREATE INDEX idx_vault_log_action ON vault_access_log(action);
CREATE INDEX idx_vault_log_created ON vault_access_log(created_at DESC);
```

### Tabla: `vault.secrets` (Supabase Vault)
**NO INTERACTUAR DIRECTAMENTE** - Supabase maneja encriptación automáticamente.

```
Encriptado en disco con Supabase-managed keys
Desencriptado en memoria vía vault.decrypted_secrets view
Nunca exponemos key material a la aplicación
```

---

## 🎯 ARQUITECTURA DE SEGURIDAD

```
┌─────────────────────────────────────────────────────┐
│  API CLIENT (React)                                 │
│  - Nunca ve secretos                                │
│  - Envía solo: archivo P12 + contraseña             │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS/TLS
                  ↓
┌─────────────────────────────────────────────────────┐
│  EXPRESS SERVER (Node.js)                           │
│  - Valida entrada                                   │
│  - Llama a storage.* methods                        │
│  - Audita acceso                                    │
│  - Nunca retorna secrets al cliente                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  ↓
         ┌────────────────────┐
         │ vault.ts Functions │
         │  - saveSecretTo*   │
         │  - getSecretFrom*  │
         │  - deleteSecret*   │
         │  - logging         │
         └────────┬───────────┘
                  │
                  ↓
    ┌─────────────────────────────────┐
    │ Supabase Vault API              │
    │ vault.create_secret()           │
    │ vault.update_secret()           │
    │ vault.delete_secret()           │
    └────────┬────────────────────────┘
             │
             ↓
    ┌─────────────────────────────────┐
    │ PostgreSQL Encryption Layer     │
    │ - AEAD authenticated encryption │
    │ - libsodium (XChaCha20Poly1305) │
    │ - Supabase-managed keys         │
    └────────┬────────────────────────┘
             │
             ↓
    ┌─────────────────────────────────┐
    │ Encrypted on Disk               │
    │ Disk, Backups, Replication      │
    │ (Nunca en texto plano)          │
    └─────────────────────────────────┘
```

---

## 🧪 TESTING

### Ejecutar Tests de Vault

```bash
# Instalar dependencias (si no están instaladas)
npm install

# Ejecutar script de test
npx ts-node scripts/test-vault.ts
```

### Qué verifica el script

1. ✅ Conexión a Supabase Vault
2. ✅ Tabla `vault_references` accesible
3. ✅ Tabla `vault_access_log` accesible
4. ✅ Schema de vault_references correcto
5. ✅ Schema de vault_access_log correcto
6. ✅ RLS está habilitado
7. ✅ Listar secretos sin ver contenido
8. ✅ Auditoría de accesos funciona
9. ✅ Índices de performance

### Esperado

```
═══════════════════════════════════════════════════════════════
   🔐 TESTING SUPABASE VAULT INTEGRATION
═══════════════════════════════════════════════════════════════

📋 Test 1: Verificar conexión a Supabase Vault
   ✅ Conexión a Vault exitosa

📋 Test 2: Verificar tabla vault_access_log existe
   ✅ Tabla vault_access_log accesible

[... más tests ...]

═══════════════════════════════════════════════════════════════
✅ TODOS LOS TESTS PASARON (9/9 - 100%)
═══════════════════════════════════════════════════════════════
```

---

## 🌐 ENDPOINTS DISPONIBLES

### Demo Endpoints en `server/routes/certificados.ts`

| Método | Ruta | Propósito |
|--------|------|----------|
| POST | `/api/tenants/:tenantId/certificados` | Subir P12 a Vault |
| GET | `/api/tenants/:tenantId/certificados/estado` | Ver estado (sin decriptar) |
| DELETE | `/api/tenants/:tenantId/certificados` | Eliminar certificado |
| POST | `/api/internal/firmar-documento` | Firmar (uso interno) |

### Ejemplo de uso: Subir certificado

```bash
curl -X POST http://localhost:5000/api/tenants/abc123/certificados \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "certificado": "MIIEpAIBAAKCAQEA...(base64)...",
    "contraseña": "MiContraseña123"
  }'

# Response (nunca retorna el certificado):
{
  "success": true,
  "message": "Certificado guardado correctamente en Vault",
  "certificado": {
    "issuer": "...",
    "fingerprint": "...",
    "expiresAt": "2026-01-15T00:00:00Z",
    "uploadedAt": "2026-01-14T10:00:00Z"
  }
}
```

---

## 📋 INTEGRACIÓN EN APLICACIÓN

### 1. Importar en `server/index.ts`

```typescript
import certificadosRouter from "./routes/certificados";

// ...

app.use("/api", certificadosRouter);
```

### 2. Actualizar endpoints existentes para usar Vault

**Antes (❌ VIEJO):**
```typescript
const { certificado } = await db.tenantCredentials.findOne();
const p12 = decrypt(certificado); // En BD encriptado
```

**Ahora (✅ NUEVO):**
```typescript
const p12 = await storage.getCertificateFromVault(tenantId, userId, ipAddress);
// Automáticamente auditado, desencriptado en memoria, nunca en BD plano
```

### 3. Migración de datos existentes

Crear script (próxima tarea):
```typescript
// scripts/migrate-to-vault.ts
// Lee de tenantCredentials (viejo)
// Guarda en Vault (nuevo)
// Verifica integridad
// Limpia datos viejos
```

---

## 🔍 AUDITORÍA Y MONITOREO

### Revisar accesos a Vault

```sql
-- Accesos exitosos en últimas 24 horas
SELECT 
  user_id, 
  action, 
  secret_type, 
  created_at 
FROM vault_access_log 
WHERE success = true 
  AND created_at > NOW() - INTERVAL '1 day' 
ORDER BY created_at DESC;

-- Intentos fallidos (indicativo de problemas)
SELECT 
  user_id, 
  error_message, 
  ip_address, 
  created_at 
FROM vault_access_log 
WHERE success = false 
ORDER BY created_at DESC 
LIMIT 20;

-- Auditoría por usuario
SELECT 
  user_id, 
  COUNT(*) as accesos,
  COUNT(CASE WHEN success = false THEN 1 END) as fallos
FROM vault_access_log 
GROUP BY user_id 
ORDER BY accesos DESC;
```

---

## ⚠️ IMPORTANTE: REGLAS DE SEGURIDAD

### ❌ NUNCA

- Guardar secretos en tabla normal de BD
- Retornar certificado/contraseña al cliente
- Loguear secretos en plaintext
- Permitir acceso anónimo a Vault
- Ignorar errores de Vault (fail loudly)
- Descifrar secreto más de lo necesario

### ✅ SIEMPRE

- Usar `storage.*ToVault()` para guardar
- Usar `storage.*FromVault()` para leer
- Validar entrada (archivo, contraseña, tamaño)
- Auditar acceso (automático)
- Fallar si tenant no coincide (automático)
- Limpiar secretos al eliminar tenant
- Revisar `vault_access_log` regularmente

---

## 📞 TROUBLESHOOTING

| Problema | Solución |
|----------|----------|
| `Table "vault_references" does not exist` | Ejecutar migración con `mcp_supabase_apply_migration` |
| `Permission denied on schema "pg_catalog"` | Esperado, usar validación en app layer (ya implementada) |
| `Unauthorized` | Verificar JWT, tenant_id, RLS policies |
| `Secret not found` | Confirmar que fue guardado con `reference_name` correcto |
| `Vault is slow` | Revisar índices, optimizar queries, considerar caching |

---

## ✅ CHECKLIST PRE-PRODUCCIÓN

- [x] Vault extension habilitada en Supabase
- [x] Tablas `vault_references` y `vault_access_log` creadas
- [x] Funciones en `vault.ts` implementadas
- [x] Storage integration completada
- [x] RLS policies creadas (app-level actualmente)
- [x] Documentación completa
- [x] Script de testing creado
- [ ] Endpoints integrados en server
- [ ] Tests automatizados en Jest
- [ ] Datos existentes migrados a Vault
- [ ] Monitoreo de `vault_access_log` configurado
- [ ] Backup verificado (encriptado)
- [ ] Equipo capacitado en VAULT_SECURITY_POLICY.md

---

**Última actualización:** 2026-01-14  
**Siguiente paso:** Integrar endpoints en `server/index.ts` y crear migración de datos
