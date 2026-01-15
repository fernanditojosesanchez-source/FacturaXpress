# 🔐 POLÍTICA DE SEGURIDAD CON SUPABASE VAULT

## Estado: ACTIVO desde 2026-01-14

### RESUMEN EJECUTIVO
Todos los datos **sensibles e importan** DEBEN almacenarse en **Supabase Vault**, nunca en texto plano o encriptación a nivel de aplicación en la base de datos directa.

---

## 📋 DATOS QUE VAN EN VAULT (OBLIGATORIO)

### 1. **Certificados Digitales** 
- ✅ Archivo P12/PFX (base64)
- ✅ Contraseña del certificado
- **Referencia:** `cert_p12`, `cert_password`
- **Ubicación:** `vault.secrets` (encriptado en disco)
- **Acceso:** `storage.getCertificateFromVault()`

### 2. **Credenciales Ministerio de Hacienda**
- ✅ Usuario MH
- ✅ Contraseña MH
- **Referencia:** `mh_password`
- **Ubicación:** `vault.secrets` (encriptado en disco)
- **Acceso:** `storage.getMHCredentialsFromVault()`

### 3. **API Keys / Tokens**
- ✅ Keys de integración externa
- ✅ Tokens de autenticación
- **Referencia:** `api_key`
- **Ubicación:** `vault.secrets`
- **Acceso:** Funciones futuras de API Key management

### 4. **Credenciales de Usuarios** (Futuro)
- ✅ OAuth tokens
- ✅ Refresh tokens
- **Referencia:** `user_credentials`
- **Ubicación:** `vault.secrets`

---

## ❌ DATOS QUE NUNCA VAN EN VAULT

- Información pública del usuario (nombre, email, teléfono) → Tabla `users` normal
- Configuración no-sensible → Tabla normal con RLS
- Logs de auditoría → Tabla `vault_access_log` con RLS
- Huellas de certificados (fingerprints) → Tabla `certificados` normal

---

## 🔒 ARQUITECTURA DE SEGURIDAD

```
┌─────────────────────────────────────────────────────┐
│  APLICACIÓN (Node.js/Express)                       │
│  - Validación de permisos                           │
│  - Logging de auditoría                             │
│  - Control de acceso por tenant                      │
└─────────────────┬───────────────────────────────────┘
                  │
                  ↓
         ┌────────────────────┐
         │ vault.ts Functions │  ← saveSecretToVault()
         │  (Service Layer)   │     getSecretFromVault()
         └────────┬───────────┘     deleteSecretFromVault()
                  │
                  ↓
         ┌────────────────────────────┐
         │ PostgreSQL VAULT Extension  │
         │ vault.secrets TABLE         │  ← Encriptado en disco
         │ vault.decrypted_secrets VW  │  ← Desencriptado en memoria
         └────────┬───────────────────┘
                  │
                  ↓
         ┌────────────────────────────┐
         │ Supabase Managed Keys       │
         │ (Fuera de la BD)            │  ← NUNCA en texto plano
         └────────────────────────────┘
```

---

## 📝 FLUJO DE GUARDADO (ESTRICTO)

### 1. Usuario carga certificado
```typescript
// ANTES (❌ NO HACER):
certificadoP12Enc: encrypt(p12) // En tabla normal

// AHORA (✅ HACER):
await storage.saveCertificateToVault(
  tenantId, 
  p12Content, 
  userId, 
  ipAddress
);
```

### 2. Vault recibe el secreto
```sql
-- vault.create_secret() → Encripta automáticamente
-- Almacena en vault.secrets (ENCRIPTADO EN DISCO)
-- Registra en vault_references (metadatos sin el secreto)
```

### 3. Leer el secreto (solo cuando sea necesario)
```typescript
// Dentro del servidor SOLAMENTE
const p12 = await storage.getCertificateFromVault(
  tenantId,
  userId,
  ipAddress
);
// ✅ Se desencripta en memoria, se audita acceso
```

### 4. Nunca enviar al cliente
```typescript
// ❌ NUNCA:
res.json({ certificate: p12 });

// ✅ SIEMPRE:
// Usar el secret DENTRO del servidor para firmar/enviar a MH
// Solo enviar confirmación: "Certificate applied successfully"
```

---

## 🚀 MÉTODOS DISPONIBLES EN `storage.ts`

### Certificados
```typescript
// Guardar certificado P12
await storage.saveCertificateToVault(tenantId, p12Content, userId, ipAddress);

// Obtener certificado (desencriptado)
const p12 = await storage.getCertificateFromVault(tenantId, userId, ipAddress);

// Guardar contraseña del certificado
await storage.saveCertificatePasswordToVault(tenantId, password, userId, ipAddress);

// Obtener contraseña del certificado
const pass = await storage.getCertificatePasswordFromVault(tenantId, userId, ipAddress);
```

### Credenciales MH
```typescript
// Guardar usuario y contraseña del MH
await storage.saveMHCredentialsToVault(tenantId, usuario, password, userId, ipAddress);

// Obtener credenciales MH
const { usuario, password } = await storage.getMHCredentialsFromVault(tenantId, userId, ipAddress);
```

### Gestión de Secretos
```typescript
// Eliminar TODOS los secretos del certificado
await storage.deleteCertificateSecretsFromVault(tenantId, userId, ipAddress);
```

---

## 📊 AUDITORÍA DE ACCESOS

### Tabla: `vault_access_log`

Cada acceso a Vault se registra automáticamente:

| Campo | Descripción |
|-------|------------|
| `user_id` | Quién accedió |
| `tenant_id` | A qué tenant |
| `action` | read/write/delete/failed_access |
| `secret_type` | cert_p12/cert_password/mh_password |
| `success` | ✅ exitoso o ❌ fallido |
| `ip_address` | IP de origen |
| `error_message` | Motivo del fallo |
| `created_at` | Timestamp del acceso |

### Consultar logs
```sql
SELECT * FROM vault_access_log 
WHERE tenant_id = '...' 
  AND action = 'read'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## 🔐 ROW LEVEL SECURITY (RLS)

### Políticas Implementadas

1. **vault_references**
   - ✅ Solo ver secretos del propio tenant
   - ✅ Solo crear secretos en su tenant
   - ✅ Solo super_admin puede ver todos
   - ✅ No se exponen secret IDs a clientes

2. **vault_access_log**
   - ✅ Solo ver logs del propio tenant
   - ✅ Auditoría protegida por tenant
   - ✅ No se pueden editar/eliminar logs

---

## ⚠️ RESTRICCIONES DE SEGURIDAD

### 1. **Tamaño máximo de secretos**
```typescript
if (secretContent.length > 100000) {
  throw new Error("El secreto es demasiado grande (máximo 100KB)");
}
```

### 2. **Validación de tipo de secreto**
```typescript
const allowedTypes = ["cert_p12", "cert_password", "mh_password", "api_key", "user_credentials"];
if (!allowedTypes.includes(secretType)) {
  throw new Error(`Tipo de secreto no válido`);
}
```

### 3. **Acceso solo autenticado**
- Requiere JWT válido
- Requiere permisos en el tenant
- Registra IP y User-Agent
- Logs de intento fallido

### 4. **No hay "lectura anónima"**
- Todos los accesos requieren `userId`
- Se audita cada lectura
- Se valida tenant del usuario vs tenant del secreto

---

## 📋 CHECKLIST PARA NUEVAS FEATURES

Si añades un nuevo tipo de secreto:

- [ ] Definir `VaultSecretType` en `lib/vault.ts`
- [ ] Crear método en `storage.ts` (`save*ToVault`, `get*FromVault`)
- [ ] Actualizar interfaz `IStorage`
- [ ] Añadir validación en `vault.ts`
- [ ] Documentar en este archivo
- [ ] Implementar auditoría automática
- [ ] Crear tests de acceso/denegación
- [ ] Nunca guardar en tabla normal después

---

## 🧪 EJEMPLOS DE USO CORRECTO

### Subir Certificado
```typescript
app.post("/api/tenants/:tenantId/certificado", async (req, res) => {
  const { p12Base64, password } = req.body;
  const { tenantId } = req.params;
  const user = req.user as any;

  // ✅ Guardar en Vault
  await storage.saveCertificateToVault(tenantId, p12Base64, user.id, getClientIP(req));
  await storage.saveCertificatePasswordToVault(tenantId, password, user.id, getClientIP(req));

  // ✅ Auditar
  await logAudit({
    userId: user.id,
    action: "CERT_UPLOADED",
    details: { tenantId }
  });

  res.json({ success: true, message: "Certificado guardado correctamente" });
});
```

### Usar Certificado para Firmar
```typescript
app.post("/api/facturas/:id/firmar", async (req, res) => {
  const user = req.user as any;
  const { tenantId, id } = req.params;

  try {
    // ✅ Obtener del Vault (solo cuando sea necesario)
    const p12 = await storage.getCertificateFromVault(tenantId, user.id, getClientIP(req));
    const password = await storage.getCertificatePasswordFromVault(tenantId, user.id, getClientIP(req));

    // ✅ Usar localmente
    const signedDocument = sign(documentXML, p12, password);

    // ✅ El secreto nunca sale del servidor
    // ✅ Enviar firma al cliente, NO el certificado
    res.json({ success: true, signature: signedDocument });

  } catch (err) {
    // ❌ Fallo registrado automáticamente en vault_access_log
    res.status(401).json({ error: "Acceso denegado" });
  }
});
```

---

## 📞 SOPORTE

- **Errores de Vault:** Ver logs en `vault_access_log`
- **Permisos denegados:** Verificar RLS policies y tenant
- **Secreto no encontrado:** Confirmar que fue guardado con `reference_name` correcto
- **Performance:** Vault es muy rápido, limitar consultas innecesarias

---

## 📅 ROADMAP

- [x] Implementar Vault base
- [x] Certificados P12 y contraseña
- [x] Credenciales MH
- [x] Auditoría de accesos
- [ ] Rotación automática de claves
- [ ] Dashboard de auditoría
- [ ] Backup encriptado de Vault
- [ ] Integración con HSM (futuro)

---

**Última actualización:** 2026-01-14  
**Estado:** ✅ PRODUCCIÓN  
**Responsable:** Equipo de Seguridad
